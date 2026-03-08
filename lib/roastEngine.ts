const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export interface RoastInput {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  steps: number;
  waterGlasses: number;
  sleepHours: number;
}

export interface RoastOutput {
  roast_text: string;
  verdict_title: string;
  verdict_emoji: string;
}

const SYSTEM_PROMPT = `You are Nyra in ROAST MODE. You roast the user's health day using Gen Z humor.
Rules:
- Be brutal but funny — never genuinely mean or hurtful
- Never mock eating disorders, body image, or mental health
- Use Gen Z slang naturally: "no cap", "it's giving", "the audacity", "main character", "NPC behavior", "caught in 4K", "lowkey/highkey", "slay", "ate", "understood the assignment"
- Reference their actual stats — make it personal
- Keep it to 2-3 sentences max
- Include a verdict from this exact list (pick the most fitting one):
  "Main Character Delusion", "Ghost Protocol", "Certified Grinder", "Actually Ate", "NPC Behavior", "Couch Goblin Mode"

Respond ONLY with valid JSON (no markdown, no backticks):
{"roast_text": "your roast here", "verdict_title": "verdict name without emoji", "verdict_emoji": "single emoji"}`;

const VERDICT_EMOJIS: Record<string, string> = {
  "Main Character Delusion": "💀",
  "Ghost Protocol": "👻",
  "Certified Grinder": "🔥",
  "Actually Ate": "👑",
  "NPC Behavior": "🤖",
  "Couch Goblin Mode": "🛋️",
};

const FALLBACK: RoastOutput = {
  roast_text: "Nyra is speechless... and that says a lot about your day 💀",
  verdict_title: "Ghost Protocol",
  verdict_emoji: "👻",
};

export async function generateRoast(input: RoastInput): Promise<RoastOutput> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) return FALLBACK;

  const userMessage = `Here's what they did today:
- Calories: ${input.calories} kcal
- Protein: ${input.protein_g}g | Carbs: ${input.carbs_g}g | Fat: ${input.fat_g}g
- Steps: ${input.steps}
- Water: ${input.waterGlasses} glasses
- Sleep: ${input.sleepHours} hours

Roast them.`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.8,
        max_tokens: 300,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return FALLBACK;

    const parsed = JSON.parse(content) as RoastOutput;
    if (!parsed.verdict_emoji && parsed.verdict_title) {
      parsed.verdict_emoji = VERDICT_EMOJIS[parsed.verdict_title] || "💀";
    }
    return parsed;
  } catch {
    return FALLBACK;
  }
}

export function getStatColor(
  value: number,
  metric: "calories" | "steps" | "sleep"
): string {
  switch (metric) {
    case "calories":
      return value < 1200 || value > 3000 ? "#ff4d4d" : "#A8FF3E";
    case "steps":
      return value < 3000 ? "#ff4d4d" : "#A8FF3E";
    case "sleep":
      return value < 6 ? "#ff4d4d" : "#A8FF3E";
    default:
      return "#A8FF3E";
  }
}

export default generateRoast;
