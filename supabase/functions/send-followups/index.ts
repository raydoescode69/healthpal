// Supabase Edge Function: send-followups
// Schedule: */30 * * * * (every 30 minutes via pg_cron)
// Purpose: Find inactive users (4+ hours), generate contextual AI follow-up,
//          push via Expo Push API, insert as message + record in followups table.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const INACTIVITY_HOURS = 4;
const MAX_FOLLOWUPS_PER_DAY = 3;
const QUIET_HOUR_START = 22; // 10 PM
const QUIET_HOUR_END = 8;   // 8 AM

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Helpers ─────────────────────────────────────────────────────

function isQuietHours(timezone: string | null): boolean {
  try {
    const tz = timezone || "Asia/Kolkata";
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    });
    const hour = parseInt(formatter.format(now), 10);
    return hour >= QUIET_HOUR_START || hour < QUIET_HOUR_END;
  } catch {
    // Default to IST if timezone parsing fails
    const hour = new Date().getUTCHours() + 5.5;
    const normalizedHour = Math.floor(hour % 24);
    return normalizedHour >= QUIET_HOUR_START || normalizedHour < QUIET_HOUR_END;
  }
}

async function generateFollowupMessage(
  messages: { role: string; content: string }[],
  profileData: Record<string, unknown> | null,
  memories: { memory_text: string }[]
): Promise<string> {
  const profileContext = profileData
    ? `User profile: Name=${profileData.name || "unknown"}, Age=${profileData.age || "?"}, Goal=${profileData.goal || "general health"}, Diet=${profileData.diet_type || "no preference"}`
    : "No profile data available.";

  const memoryContext = memories.length > 0
    ? `Key memories: ${memories.map((m) => m.memory_text).join("; ")}`
    : "";

  const recentChat = messages
    .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
    .join("\n");

  const systemPrompt = `You are Nyra, a friendly health buddy. You speak in casual Hinglish (Hindi + English mix) like a 24yo Indian friend on WhatsApp.

Generate a SHORT follow-up message (1-2 sentences max) to re-engage the user who hasn't messaged in a while. Be natural, caring, not pushy.

${profileContext}
${memoryContext}

Rules:
- Reference something specific from their recent conversation or goals
- Include a gentle question or nudge about their health
- Use casual Hinglish tone with occasional emoji
- Do NOT say "I noticed you haven't messaged" or anything meta
- Keep it under 80 words
- Sound like a caring friend checking in, not a bot`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: "[SYSTEM: Generate a follow-up message to re-engage this user]" },
      ],
      max_tokens: 150,
      temperature: 0.85,
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "hey! sab theek? kal kya khaya batao na";
}

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<string[]> {
  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data: { ...data, channelId: "followups" },
    channelId: "followups",
    priority: "high",
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });

  const result = await response.json();
  const staleTokens: string[] = [];

  // Check for DeviceNotRegistered errors
  if (result.data && Array.isArray(result.data)) {
    result.data.forEach((ticket: { status: string; details?: { error: string } }, i: number) => {
      if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        staleTokens.push(tokens[i]);
      }
    });
  }

  return staleTokens;
}

// ── Main Handler ────────────────────────────────────────────────

serve(async (req) => {
  try {
    const cutoff = new Date(Date.now() - INACTIVITY_HOURS * 60 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 1. Find users with push tokens who have messages
    const { data: usersWithTokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("user_id, token, platform");

    if (tokenError || !usersWithTokens?.length) {
      return new Response(JSON.stringify({ message: "No users with tokens", error: tokenError }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Group tokens by user
    const userTokens = new Map<string, string[]>();
    for (const row of usersWithTokens) {
      const existing = userTokens.get(row.user_id) || [];
      existing.push(row.token);
      userTokens.set(row.user_id, existing);
    }

    const userIds = Array.from(userTokens.keys());
    let processedCount = 0;
    let skippedCount = 0;
    const allStaleTokens: string[] = [];

    for (const userId of userIds) {
      // 2. Check last message time — must be > 4 hours ago
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!lastMsg || lastMsg.created_at > cutoff) {
        skippedCount++;
        continue; // User is active or has no messages
      }

      // 3. Check rate limit — max 3 followups today
      const { count: todayFollowups } = await supabase
        .from("followups")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("sent", true)
        .gte("created_at", todayStart.toISOString());

      if ((todayFollowups ?? 0) >= MAX_FOLLOWUPS_PER_DAY) {
        skippedCount++;
        continue;
      }

      // 4. Check quiet hours using user's timezone from profiles
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", userId)
        .single();

      if (isQuietHours(profileRow?.timezone ?? null)) {
        skippedCount++;
        continue;
      }

      // 5. Load context for AI message generation
      const { data: recentMessages } = await supabase
        .from("messages")
        .select("role, content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8);

      const { data: profileData } = await supabase
        .from("user_profile_data")
        .select("*")
        .eq("user_id", userId)
        .single();

      const { data: memories } = await supabase
        .from("memories")
        .select("memory_text")
        .eq("user_id", userId)
        .order("importance", { ascending: false })
        .limit(3);

      // 6. Generate contextual follow-up message
      const followupText = await generateFollowupMessage(
        (recentMessages || []).reverse(),
        profileData,
        memories || []
      );

      // 7. Get user's latest conversation
      const { data: latestConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const conversationId = latestConv?.id ?? null;

      // 8. Send push notification
      const tokens = userTokens.get(userId) || [];
      const staleTokens = await sendExpoPush(
        tokens,
        "Nyra",
        followupText,
        { conversationId, type: "followup" }
      );
      allStaleTokens.push(...staleTokens);

      // 9. Insert as message in the conversation
      if (conversationId) {
        await supabase.from("messages").insert({
          user_id: userId,
          role: "assistant",
          content: followupText,
          conversation_id: conversationId,
          message_type: "followup",
        });
      }

      // 10. Record in followups table for rate limiting
      await supabase.from("followups").insert({
        user_id: userId,
        message: followupText,
        send_at: new Date().toISOString(),
        sent: true,
        conversation_id: conversationId,
        followup_type: "inactivity",
      });

      processedCount++;
    }

    // 11. Cleanup stale tokens
    if (allStaleTokens.length > 0) {
      await supabase
        .from("push_tokens")
        .delete()
        .in("token", allStaleTokens);
    }

    return new Response(
      JSON.stringify({
        message: "Follow-ups processed",
        processed: processedCount,
        skipped: skippedCount,
        staleTokensCleaned: allStaleTokens.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-followups] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
