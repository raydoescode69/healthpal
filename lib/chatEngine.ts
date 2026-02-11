import { supabase } from "./supabase";
import type { ParsedBotResponse, DietPlanData } from "./types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

// ── Types ────────────────────────────────────────────────────
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface UserProfileData {
  name?: string | null;
  age?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  goal?: string | null;
  diet_type?: string | null;
  allergies?: string | null;
  occupation?: string | null;
}

interface LoadedContext {
  profile: UserProfileData | null;
  recentMessages: ChatMessage[];
  memories: string[];
}

// ── loadContext ──────────────────────────────────────────────
export async function loadContext(userId: string): Promise<LoadedContext> {
  const [profileRes, messagesRes, memoriesRes] = await Promise.all([
    supabase
      .from("user_profile_data")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("memories")
      .select("memory_text")
      .eq("user_id", userId)
      .order("importance", { ascending: false })
      .limit(5),
  ]);

  const recentMessages: ChatMessage[] = (messagesRes.data || [])
    .reverse()
    .map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const memories = (memoriesRes.data || []).map(
    (m: { memory_text: string }) => m.memory_text
  );

  return {
    profile: profileRes.data || null,
    recentMessages,
    memories,
  };
}

// ── buildSystemPrompt ────────────────────────────────────────
export function buildSystemPrompt(context: LoadedContext): string {
  const hour = new Date().getHours();
  const timeOfDay =
    hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const p = context.profile;
  let profileBlock = "";
  if (p) {
    const lines: string[] = [];
    if (p.name) lines.push(`Name: ${p.name}`);
    if (p.age) lines.push(`Age: ${p.age}`);
    if (p.weight_kg) lines.push(`Weight: ${p.weight_kg} kg`);
    if (p.height_cm) lines.push(`Height: ${p.height_cm} cm`);
    if (p.goal) lines.push(`Goal: ${p.goal.replace(/_/g, " ")}`);
    if (p.diet_type) lines.push(`Diet: ${p.diet_type.replace(/_/g, " ")}`);
    if (p.allergies) lines.push(`Allergies: ${p.allergies}`);
    if (p.occupation) lines.push(`Occupation: ${p.occupation}`);
    if (lines.length > 0) {
      profileBlock = `\n\nWhat you know about the user:\n${lines.map((l) => `- ${l}`).join("\n")}`;
    }
  }

  let memoriesBlock = "";
  if (context.memories.length > 0) {
    memoriesBlock = `\n\nMemories from past conversations:\n${context.memories.map((m) => `- ${m}`).join("\n")}`;
  }

  return `You are Pal — a 24 year old Indian fitness-conscious friend texting on WhatsApp. It's ${timeOfDay}.${profileBlock}${memoriesBlock}

PERSONALITY:
- Text like a real 24yo Indian guy on WhatsApp. Use "yaar", "bhai", "chill", "haan", "nahi" naturally.
- Mirror user's language — if English, reply English. If Hinglish, reply Hinglish.
- Be a little funny sometimes, use "lol", "haha" naturally
- If user is sad/demotivated, be warm and supportive like a real friend

RESPONSE FORMAT:
- Max 2 sentences per message bubble
- Separate multiple bubbles with "|||"
- Keep it casual and concise

BANNED PHRASES (never use these):
- "Certainly!", "Of course!", "Great question!", "As an AI", "I understand", "It's important to note"
- "I'd be happy to", "Absolutely!", "That's a great"

DIET PLAN FORMAT:
When the user EXPLICITLY asks for a diet plan, meal plan, eating schedule, or uses words like "diet plan", "meal plan", "khana plan", "new plan", "update plan":
- If you have their profile data (weight, goal, diet_type), generate a PERSONALIZED plan
- If you don't have enough info, generate a GENERIC plan and offer to personalize
- Output the plan as a single line starting with "DIET_PLAN:" followed by valid JSON:
DIET_PLAN:{"type":"DIET_PLAN","is_personalized":false,"daily_calories":2000,"days":[{"day":"Monday","meals":[{"emoji":"🥣","name":"Oats Bowl","time":"8:00 AM","cal":350}]}]}
- Include 7 days, each with 4-5 meals (breakfast, snack, lunch, snack, dinner)
- Add a text bubble before the diet plan line explaining it briefly

CRITICAL DIET PLAN RULES:
- ONLY include DIET_PLAN: JSON when user EXPLICITLY asks for a diet/meal plan
- NEVER send a diet plan for casual messages like "ok", "thanks", "smjh gaya", "what?", "haan", general questions, etc.
- If user says "yes customize" or "personalize" → ask for missing info one question at a time, do NOT send another plan yet
- Once you have enough data AND user confirms → then send personalized plan
- When in doubt, do NOT include DIET_PLAN: — just reply with normal text

SCOPE:
- nutrition, diet, fitness, workouts, mental wellness, sleep, hydration, supplements
- Off-topic? Reply: "haha bhai that's above my pay grade 😂 health stuff toh pucho!"
- Don't diagnose medical conditions. Serious stuff → casually suggest seeing a doctor.

MEMORY RULES:
- NEVER assume data about the user that isn't listed above
- NEVER make up stats, weights, or health data`;
}

// ── callOpenAI ───────────────────────────────────────────────
async function callOpenAI(
  messages: ChatMessage[],
  model: string = "gpt-4o",
  maxTokens: number = 1000,
  temperature: number = 0.75
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map(({ role, content }) => ({ role, content })),
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response content from OpenAI");

  return content.trim();
}

// ── parseResponse ────────────────────────────────────────────
export function parseResponse(raw: string): ParsedBotResponse {
  let dietPlan: DietPlanData | undefined;
  const textParts: string[] = [];

  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("DIET_PLAN:")) {
      try {
        const jsonStr = trimmed.slice("DIET_PLAN:".length).trim();
        dietPlan = JSON.parse(jsonStr) as DietPlanData;
      } catch {
        // If JSON parse fails, treat as regular text
        textParts.push(trimmed);
      }
    } else if (trimmed) {
      textParts.push(trimmed);
    }
  }

  // Join remaining text and split by ||| delimiter
  const joined = textParts.join("\n");
  const bubbles = joined
    .split("|||")
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  return { bubbles, dietPlan };
}

// ── sendMessage ──────────────────────────────────────────────
// Keywords that indicate user explicitly wants a diet plan
const DIET_PLAN_KEYWORDS = [
  "diet plan", "meal plan", "khana plan", "new plan", "update plan",
  "food plan", "eating plan", "nutrition plan", "weekly plan",
  "diet chart", "meal chart", "7 day plan", "seven day plan",
];

function userExplicitlyWantsDietPlan(message: string): boolean {
  const lower = message.toLowerCase();
  return DIET_PLAN_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function sendMessage(
  userId: string,
  conversationId: string,
  userMessage: string,
  messageHistory: { role: "user" | "assistant"; content: string }[],
  dietPlanAlreadyShown: boolean = false
): Promise<ParsedBotResponse> {
  const context = await loadContext(userId);
  const systemPrompt = buildSystemPrompt(context);

  // If diet plan was already shown and user isn't explicitly asking for one, add instruction
  let extraInstruction = "";
  if (dietPlanAlreadyShown && !userExplicitlyWantsDietPlan(userMessage)) {
    extraInstruction = "\n\nIMPORTANT: A diet plan was already shown in this conversation. Do NOT include DIET_PLAN: JSON in your response. Just reply with normal text.";
  }

  // Build messages array: system + recent history + current message
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt + extraInstruction },
    ...messageHistory.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const raw = await callOpenAI(messages, "gpt-4o", 1500, 0.75);

  // Background extraction (fire and forget)
  extractProfileInBackground(userId, userMessage).catch(() => {});

  const parsed = parseResponse(raw);

  // Double-guard: strip diet plan if already shown and user didn't ask
  if (dietPlanAlreadyShown && !userExplicitlyWantsDietPlan(userMessage)) {
    parsed.dietPlan = undefined;
  }

  return parsed;
}

// ── extractProfileInBackground ───────────────────────────────
async function extractProfileInBackground(
  userId: string,
  userMessage: string
): Promise<void> {
  const extractionPrompt = `Extract any personal/health data from this user message. Return ONLY valid JSON with any of these fields that are mentioned (omit fields not mentioned):
{"name":"string","age":number,"weight_kg":number,"height_cm":number,"goal":"string","diet_type":"string","allergies":"string","occupation":"string"}

If NO personal data is found, return exactly: {}

User message: "${userMessage}"`;

  const result = await callOpenAI(
    [{ role: "system", content: extractionPrompt }],
    "gpt-4o-mini",
    200,
    0.1
  );

  try {
    const extracted = JSON.parse(result);
    if (Object.keys(extracted).length === 0) return;

    // Upsert to user_profile_data
    const { data: existing } = await supabase
      .from("user_profile_data")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("user_profile_data")
        .update({ ...extracted, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    } else {
      await supabase.from("user_profile_data").insert({
        user_id: userId,
        ...extracted,
        updated_at: new Date().toISOString(),
      });
    }
  } catch {
    // Silent fail for background task
  }
}

// ── generateWelcome ──────────────────────────────────────────
export async function generateWelcome(userId: string): Promise<string> {
  const context = await loadContext(userId);
  const systemPrompt = buildSystemPrompt(context);

  const hour = new Date().getHours();
  const name = context.profile?.name || "bhai";
  const greeting =
    hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const welcomePrompt = `User just opened the app. Send a short warm welcome like a WhatsApp friend. Say something like "yo ${name}! good ${greeting}" then casually ask what's up. 1-2 sentences max. Sound like a real person, not a bot. Use "yaar"/"bhai" naturally if it fits.`;

  const raw = await callOpenAI(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: welcomePrompt },
    ],
    "gpt-4o",
    200,
    0.8
  );

  return raw;
}
