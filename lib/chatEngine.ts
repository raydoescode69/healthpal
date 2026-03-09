import { supabase } from "./supabase";
import { generateDietPlan } from "./dietEngine";
import { formatKBContext } from "./knowledgeBase";
import type { ParsedBotResponse, DietPlanData, FoodAnalysisResult } from "./types";

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

  return `You are Nyra — a 24 year old Indian fitness-conscious friend texting on WhatsApp. It's ${timeOfDay}.${profileBlock}${memoriesBlock}

PERSONALITY:
- Text like a friendly, warm health companion. Be conversational and supportive, but not overly informal.
- Mirror the user's language naturally — if English, reply English. If Hinglish, reply Hinglish.
- Be a little funny sometimes, use "lol", "haha" naturally
- If user is sad/demotivated, be warm and supportive like a real friend
- NEVER use: "bhai", "yaar", "chill", "haan", "nahi", "arre" — keep tone casual but clean

RESPONSE FORMAT:
- Max 2 sentences per message bubble
- Separate multiple bubbles with "|||"
- Keep it casual and concise

BANNED PHRASES (never use these):
- "Certainly!", "Of course!", "Great question!", "As an AI", "I understand", "It's important to note"
- "I'd be happy to", "Absolutely!", "That's a great"

DIET PLAN:
- When the user asks for a diet plan, a plan card is generated AUTOMATICALLY by the app — you do NOT need to create one
- NEVER output JSON, DIET_PLAN:, code blocks, or structured data in your response
- Just reply with a brief, casual intro like "here's your personalized plan!" and the card will appear automatically
- If user asks to customize or personalize their plan, ask for missing info one question at a time

SCOPE:
- nutrition, diet, fitness, workouts, mental wellness, sleep, hydration, supplements
- Off-topic? Reply: "haha that's a bit out of my zone 😂 ask me anything health or nutrition related though!"
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

// ── detectFoodLogIntent ──────────────────────────────────────
async function detectFoodLogIntent(
  message: string
): Promise<{ isLogIntent: boolean; foodDescription: string }> {
  try {
    const result = await callOpenAI(
      [
        {
          role: "system",
          content: `Does this message describe food the user ate or drank? If yes, extract the food description. Return ONLY valid JSON: {"isLogIntent": true/false, "foodDescription": "..."}\n\nRules:\n- "maine 2 roti khayi" → true\n- "I had coffee" → true\n- "what should I eat?" → false\n- "suggest a diet" → false\n- Greetings, questions, thanks → false`,
        },
        { role: "user", content: message },
      ],
      "gpt-4o-mini",
      150,
      0.1
    );

    const parsed = JSON.parse(result);
    return {
      isLogIntent: !!parsed.isLogIntent,
      foodDescription: parsed.foodDescription || "",
    };
  } catch {
    return { isLogIntent: false, foodDescription: "" };
  }
}

// ── analyzeFoodFromChat (lightweight inline analysis) ─────────
async function analyzeFoodFromChat(
  description: string
): Promise<FoodAnalysisResult | null> {
  try {
    const hour = new Date().getHours();
    const mealType =
      hour < 11 ? "breakfast" : hour < 15 ? "lunch" : hour < 18 ? "snack" : "dinner";

    const result = await callOpenAI(
      [
        {
          role: "system",
          content: `You are a nutrition analyzer. Given a food description, estimate its nutritional content. Return ONLY valid JSON:\n{"food_name":"string","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"meal_type":"string","confidence":"high"|"medium"|"low","portion_size":"string"}\n\nBe accurate with Indian foods. Use common portion sizes. meal_type should be: ${mealType}`,
        },
        { role: "user", content: `Analyze: "${description}"` },
      ],
      "gpt-4o-mini",
      300,
      0.3
    );

    return JSON.parse(result) as FoodAnalysisResult;
  } catch {
    return null;
  }
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

// Keywords that indicate user wants to PERSONALIZE (not just generate)
const PERSONALIZE_KEYWORDS = [
  "personalize", "personalise", "customize", "customise", "tailor",
  "based on my", "for my lifestyle", "for my routine",
  "regenerate", "update my plan", "new personalized",
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
  // Detect food logging intent in parallel with context loading
  const [context, foodIntent] = await Promise.all([
    loadContext(userId),
    detectFoodLogIntent(userMessage),
  ]);

  const systemPrompt = buildSystemPrompt(context);

  // Search knowledge base for relevant health info
  const kbContext = await formatKBContext(userMessage, 3);

  // If diet plan was already shown and user isn't explicitly asking for one, add instruction
  let extraInstruction = kbContext;
  if (dietPlanAlreadyShown && !userExplicitlyWantsDietPlan(userMessage)) {
    extraInstruction += "\n\nIMPORTANT: A diet plan was already shown in this conversation. Do NOT include DIET_PLAN: JSON in your response. Just reply with normal text.";
  }

  // If food intent detected, add instruction for the AI to acknowledge it
  if (foodIntent.isLogIntent) {
    extraInstruction += "\n\nThe user just told you what they ate. Acknowledge it briefly and naturally. A food log card will be shown automatically — do NOT list nutrition details yourself.";
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
  const isPersonalizeRequest = PERSONALIZE_KEYWORDS.some((kw) => userMessage.toLowerCase().includes(kw));
  console.log("[ChatEngine] isDietRequest:", isDietRequest, "isPersonalize:", isPersonalizeRequest, "dietPlanAlreadyShown:", dietPlanAlreadyShown, "msg:", userMessage.slice(0, 60));

  // ── Personalize path: ask lifestyle questions instead of generating plan ──
  if (isPersonalizeRequest && isDietRequest && dietPlanAlreadyShown) {
    messages.push({
      role: "system",
      content: `The user wants a PERSONALIZED diet plan. You already showed a generic one. Now ask 2-3 short lifestyle questions to personalize it better. Ask about:
- Their occupation / daily routine (desk job, physical work, student, etc.)
- Their typical schedule (when they wake up, work hours, when they sleep)
- Activity level beyond work (gym, sports, walks, sedentary)
- Any food preferences or restrictions not already known

Ask these naturally in 2-3 casual bubbles separated by |||. Do NOT generate a diet plan yet. Just gather info.`,
    });

    const raw = await callOpenAI(messages, "gpt-4o-mini", 400, 0.75);
    extractProfileInBackground(userId, userMessage).catch(() => {});
    return parseResponse(raw);
  }

  // ── Fast path: generate diet plan locally, only ask AI for intro text ──
  if (isDietRequest && !dietPlanAlreadyShown) {
    // Generate diet plan instantly using local offline engine
    const localPlan = generateDietPlan({
      weight_kg: context.profile?.weight_kg,
      height_cm: context.profile?.height_cm,
      age: context.profile?.age,
      goal: context.profile?.goal,
      diet_type: context.profile?.diet_type,
      allergies: context.profile?.allergies,
    });

    // Ask AI for just a brief intro message (fast, small response)
    messages.push({
      role: "system",
      content: "The user asked for a diet plan. A diet plan card will be shown automatically. Just write 1-2 short casual sentences introducing it. Do NOT list any meals or nutrition details. Keep it very brief.",
    });

    const [raw, foodLogResult] = await Promise.all([
      callOpenAI(messages, "gpt-4o-mini", 200, 0.75),
      foodIntent.isLogIntent
        ? analyzeFoodFromChat(foodIntent.foodDescription)
        : Promise.resolve(null),
    ]);

    extractProfileInBackground(userId, userMessage).catch(() => {});

    const parsed = parseResponse(raw);
    parsed.dietPlan = localPlan;
    console.log("[ChatEngine] Fast path: dietPlan set, days:", localPlan?.days?.length, "bubbles:", parsed.bubbles.length);

    if (foodLogResult) {
      parsed.foodLogResult = foodLogResult;
    }

    return parsed;
  }

  // ── Check if user is providing lifestyle data for diet personalization ──
  const recentHistory = messageHistory.slice(-4);
  const aiAskedLifestyleQuestions = recentHistory.some(
    (m) => m.role === "assistant" && (
      m.content.toLowerCase().includes("occupation") ||
      m.content.toLowerCase().includes("routine") ||
      m.content.toLowerCase().includes("schedule") ||
      m.content.toLowerCase().includes("activity level") ||
      m.content.toLowerCase().includes("typical day")
    )
  );

  // If AI just asked lifestyle questions and user replied, regenerate diet plan
  if (aiAskedLifestyleQuestions && !isDietRequest && dietPlanAlreadyShown) {
    // Extract profile data first
    await extractProfileInBackground(userId, userMessage);

    // Reload context with updated profile
    const updatedContext = await loadContext(userId);

    const localPlan = generateDietPlan({
      weight_kg: updatedContext.profile?.weight_kg,
      height_cm: updatedContext.profile?.height_cm,
      age: updatedContext.profile?.age,
      goal: updatedContext.profile?.goal,
      diet_type: updatedContext.profile?.diet_type,
      allergies: updatedContext.profile?.allergies,
    });

    messages.push({
      role: "system",
      content: "The user just provided their lifestyle details. Acknowledge what they shared briefly and say you've updated their plan. Keep it to 1-2 casual sentences. A new diet plan card will appear automatically.",
    });

    const raw = await callOpenAI(messages, "gpt-4o-mini", 200, 0.75);
    const parsed = parseResponse(raw);
    parsed.dietPlan = localPlan;
    return parsed;
  }

  // ── Normal path: no diet plan generation needed ──
  const maxTokens = 1500;

  // Always reinforce: never output JSON or DIET_PLAN markers
  extraInstruction += "\n\nNEVER output JSON, code blocks, or DIET_PLAN: markers. Diet plan cards are generated automatically by the app. Just reply with normal conversational text.";

  if (dietPlanAlreadyShown) {
    extraInstruction += "\nA diet plan was already shown in this conversation. Do NOT generate another one.";
  }

  // Run AI response and food analysis in parallel (if food intent detected)
  const [raw, foodLogResult] = await Promise.all([
    callOpenAI(messages, "gpt-4o", maxTokens, 0.75),
    foodIntent.isLogIntent
      ? analyzeFoodFromChat(foodIntent.foodDescription)
      : Promise.resolve(null),
  ]);

  // Background extraction (fire and forget)
  extractProfileInBackground(userId, userMessage).catch(() => {});

  const parsed = parseResponse(raw);

  // If AI accidentally generated a diet plan JSON, replace with local plan
  if (parsed.dietPlan && !dietPlanAlreadyShown) {
    parsed.dietPlan = generateDietPlan({
      weight_kg: context.profile?.weight_kg,
      height_cm: context.profile?.height_cm,
      age: context.profile?.age,
      goal: context.profile?.goal,
      diet_type: context.profile?.diet_type,
      allergies: context.profile?.allergies,
    });
  } else if (dietPlanAlreadyShown) {
    parsed.dietPlan = undefined;
  }

  // Attach food log result if detected
  if (foodLogResult) {
    parsed.foodLogResult = foodLogResult;
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
export async function generateWelcome(userId: string, isFirstEver: boolean = false): Promise<string> {
  const context = await loadContext(userId);
  const systemPrompt = buildSystemPrompt(context);

  const hour = new Date().getHours();
  const name = context.profile?.name || "there";
  const greeting =
    hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  let welcomePrompt: string;

  if (isFirstEver) {
    welcomePrompt = `This is the user's VERY FIRST time using Nyra. Introduce yourself warmly and briefly. Your name is Nyra. Tell them what you can help with.

Send 3-4 separate message bubbles using "|||" to separate them:
- Bubble 1: A warm greeting like "hey ${name}! good ${greeting}, I'm Nyra — your personal nutrition companion"
- Bubble 2: What you can do: track calories just by telling you what they ate, personalized diet plans, water & step tracking
- Bubble 3: Something encouraging to get started

Keep each bubble to 1-2 sentences max. Sound warm and friendly, not formal. Remember to separate bubbles with |||`;
  } else {
    welcomePrompt = `User just opened the app. Send a short warm welcome. Say something like "hey ${name}! good ${greeting}" then casually ask what's up. 1-2 sentences max. Sound like a real person, not a bot. Keep it warm but not overly informal. Use ||| to separate if you need more than one bubble.`;
  }

  const raw = await callOpenAI(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: welcomePrompt },
    ],
    isFirstEver ? "gpt-4o" : "gpt-4o-mini",
    isFirstEver ? 400 : 200,
    0.8
  );

  return raw;
}
