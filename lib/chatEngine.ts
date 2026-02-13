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

// ── Calorie & macro calculations ─────────────────────────────
function calculateDailyCalories(profile: UserProfileData | null): number {
  if (!profile?.weight_kg || !profile?.height_cm || !profile?.age) return 2000;
  // Mifflin-St Jeor (male default — close enough for both genders in this context)
  const bmr = 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * profile.age + 5;
  const tdee = bmr * 1.55; // moderate activity
  const goal = profile.goal?.toLowerCase() || "";
  if (goal.includes("lose")) return Math.round(tdee - 500);
  if (goal.includes("gain") || goal.includes("muscle")) return Math.round(tdee + 400);
  return Math.round(tdee);
}

function calculateMacros(
  calories: number,
  goal: string | null | undefined
): { protein: number; carbs: number; fat: number } {
  const g = (goal || "").toLowerCase();
  let pPct = 0.3, cPct = 0.4, fPct = 0.3;
  if (g.includes("lose")) { pPct = 0.35; cPct = 0.35; fPct = 0.3; }
  if (g.includes("gain") || g.includes("muscle")) { pPct = 0.35; cPct = 0.45; fPct = 0.2; }
  if (g.includes("keto")) { pPct = 0.3; cPct = 0.1; fPct = 0.6; }
  return {
    protein: Math.round((calories * pPct) / 4),
    carbs: Math.round((calories * cPct) / 4),
    fat: Math.round((calories * fPct) / 9),
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
- Target daily calories: ${calculateDailyCalories(p)} kcal
- Target macros: ~${calculateMacros(calculateDailyCalories(p), p?.goal).protein}g protein, ~${calculateMacros(calculateDailyCalories(p), p?.goal).carbs}g carbs, ~${calculateMacros(calculateDailyCalories(p), p?.goal).fat}g fat
- Output the plan as a single line starting with "DIET_PLAN:" followed by valid JSON:
DIET_PLAN:{"type":"DIET_PLAN","is_personalized":true,"daily_calories":${calculateDailyCalories(p)},"daily_protein_g":${calculateMacros(calculateDailyCalories(p), p?.goal).protein},"daily_carbs_g":${calculateMacros(calculateDailyCalories(p), p?.goal).carbs},"daily_fat_g":${calculateMacros(calculateDailyCalories(p), p?.goal).fat},"days":[{"day":"Monday","meals":[{"emoji":"🥣","name":"Masala Oats","time":"8:00 AM","cal":320,"protein_g":12,"carbs_g":45,"fat_g":8,"portion":"1 bowl (200g)"}]}]}
- Include 7 days, each with 5 meals (breakfast, mid-morning snack, lunch, evening snack, dinner)
- ALL 7 days must have UNIQUE meals — no repeated meals across days
- Every meal MUST include protein_g, carbs_g, fat_g, and portion fields
- Include Indian food options naturally (dal, roti, paneer, chicken curry, idli, poha, etc.) mixed with global options
- Respect diet_type: ${p?.diet_type ? p.diet_type.replace(/_/g, " ") : "no preference"} — never include non-veg items for veg/vegan users
- Add a short text bubble BEFORE the DIET_PLAN: line (e.g. "here's your plan bhai 💪")
- The DIET_PLAN: line MUST be on its OWN line with the COMPLETE JSON on that SAME line — do NOT pretty-print, do NOT use newlines inside the JSON, do NOT wrap in code blocks
- The entire JSON must be a SINGLE LINE of minified JSON immediately after "DIET_PLAN:"

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
  let textContent = raw;

  // Strategy 1: Find DIET_PLAN: marker and extract everything after it as JSON
  const dietMarkerIdx = raw.indexOf("DIET_PLAN:");
  if (dietMarkerIdx !== -1) {
    const beforeMarker = raw.slice(0, dietMarkerIdx);
    const afterMarker = raw.slice(dietMarkerIdx + "DIET_PLAN:".length);

    // Extract JSON — find the outermost { ... } block
    const jsonStart = afterMarker.indexOf("{");
    if (jsonStart !== -1) {
      let depth = 0;
      let jsonEnd = -1;
      for (let i = jsonStart; i < afterMarker.length; i++) {
        if (afterMarker[i] === "{") depth++;
        else if (afterMarker[i] === "}") {
          depth--;
          if (depth === 0) { jsonEnd = i; break; }
        }
      }
      if (jsonEnd !== -1) {
        const jsonStr = afterMarker.slice(jsonStart, jsonEnd + 1);
        try {
          dietPlan = JSON.parse(jsonStr) as DietPlanData;
          // Text is everything before the marker + everything after the JSON
          textContent = beforeMarker + afterMarker.slice(jsonEnd + 1);
        } catch {
          // JSON parse failed, try cleaning it
          try {
            const cleaned = jsonStr.replace(/[\n\r\t]/g, "").replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
            dietPlan = JSON.parse(cleaned) as DietPlanData;
            textContent = beforeMarker + afterMarker.slice(jsonEnd + 1);
          } catch {
            // Give up on this approach
          }
        }
      }
    }
  }

  // Strategy 2: If no DIET_PLAN marker found, look for JSON in code blocks
  if (!dietPlan) {
    const codeBlockMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?"type"\s*:\s*"DIET_PLAN"[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      try {
        const cleaned = codeBlockMatch[1].replace(/[\n\r\t]/g, "").replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
        dietPlan = JSON.parse(cleaned) as DietPlanData;
        textContent = raw.replace(codeBlockMatch[0], "");
      } catch {}
    }
  }

  // Strategy 3: Look for raw JSON with "type":"DIET_PLAN" anywhere
  if (!dietPlan) {
    const rawJsonMatch = raw.match(/(\{[\s\S]*?"type"\s*:\s*"DIET_PLAN"[\s\S]*)/);
    if (rawJsonMatch) {
      const fragment = rawJsonMatch[1];
      const jsonStart = 0;
      let depth = 0;
      let jsonEnd = -1;
      for (let i = jsonStart; i < fragment.length; i++) {
        if (fragment[i] === "{") depth++;
        else if (fragment[i] === "}") {
          depth--;
          if (depth === 0) { jsonEnd = i; break; }
        }
      }
      if (jsonEnd !== -1) {
        try {
          const cleaned = fragment.slice(0, jsonEnd + 1).replace(/[\n\r\t]/g, "").replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
          dietPlan = JSON.parse(cleaned) as DietPlanData;
          textContent = raw.replace(fragment.slice(0, jsonEnd + 1), "");
        } catch {}
      }
    }
  }

  // Clean up text: remove code block markers, DIET_PLAN: leftover, empty lines
  textContent = textContent
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .replace(/DIET_PLAN:\s*/g, "")
    .trim();

  // Split by ||| delimiter into bubbles
  let bubbles = textContent
    .split("|||")
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  // Strategy 4: Check individual bubbles for embedded DIET_PLAN JSON
  if (!dietPlan) {
    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i];
      if (bubble.includes('"type"') && bubble.includes('DIET_PLAN')) {
        const jsonMatch = bubble.match(/(\{[\s\S]*"type"\s*:\s*"DIET_PLAN"[\s\S]*)/);
        if (jsonMatch) {
          const fragment = jsonMatch[1];
          let depth = 0;
          let jsonEnd = -1;
          for (let j = 0; j < fragment.length; j++) {
            if (fragment[j] === "{") depth++;
            else if (fragment[j] === "}") {
              depth--;
              if (depth === 0) { jsonEnd = j; break; }
            }
          }
          if (jsonEnd !== -1) {
            try {
              const cleaned = fragment.slice(0, jsonEnd + 1).replace(/[\n\r\t]/g, "").replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
              dietPlan = JSON.parse(cleaned) as DietPlanData;
              // Remove the JSON from this bubble, keep any preceding text
              const beforeJson = bubble.slice(0, bubble.indexOf(jsonMatch[1])).trim();
              if (beforeJson) {
                bubbles[i] = beforeJson;
              } else {
                bubbles.splice(i, 1);
              }
              break;
            } catch {}
          }
        }
      }
    }
  }

  // Clean any leftover JSON fragments from text bubbles
  bubbles = bubbles
    .map((b) => b.replace(/\{[\s\S]*"type"\s*:\s*"DIET_PLAN"[\s\S]*\}/g, "").trim())
    .filter((b) => b.length > 0);

  return { bubbles, dietPlan };
}

// ── sendMessage ──────────────────────────────────────────────
// Keywords that indicate user explicitly wants a diet plan
const DIET_PLAN_KEYWORDS = [
  "diet plan", "meal plan", "khana plan", "new plan", "update plan",
  "food plan", "eating plan", "nutrition plan", "weekly plan",
  "diet chart", "meal chart", "7 day plan", "seven day plan",
  "give me a plan", "make me a plan", "create a plan", "plan bana",
  "diet bana", "plan de", "plan do", "give me a diet", "make a diet",
  "suggest a diet", "suggest a plan", "generate a plan",
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

  const isDietRequest = userExplicitlyWantsDietPlan(userMessage);
  const maxTokens = isDietRequest ? 3500 : 1500;

  // When user explicitly asks for diet plan, add a reinforcement message
  if (isDietRequest) {
    messages.push({
      role: "system",
      content: `IMPORTANT REMINDER: The user is asking for a diet plan. You MUST respond with DIET_PLAN: followed by minified JSON on a single line. Do NOT write the plan as plain text. Do NOT use markdown tables or bullet points for the plan. Output ONLY the DIET_PLAN:{...json...} format with all 7 days and 5 meals each. Add a brief text bubble before it.`,
    });
  }

  const raw = await callOpenAI(messages, "gpt-4o", maxTokens, 0.75);

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
