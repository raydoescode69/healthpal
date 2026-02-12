import type { FoodAnalysisResult } from "./types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

function inferMealType(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snack";
  return "dinner";
}

const ANALYSIS_PROMPT = `You are a nutrition analyzer. Estimate the nutritional content of the described food.
Return ONLY valid JSON with these exact fields (no extra text):
{"food_name":"string","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"meal_type":"string"}

meal_type should be one of: breakfast, lunch, snack, dinner.
Be reasonable with estimates. Use standard serving sizes if not specified.`;

function parseAnalysisResponse(raw: string): FoodAnalysisResult {
  // Try to extract JSON from the response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    food_name: parsed.food_name || "Unknown food",
    calories: Math.round(Number(parsed.calories) || 0),
    protein_g: Math.round(Number(parsed.protein_g) || 0),
    carbs_g: Math.round(Number(parsed.carbs_g) || 0),
    fat_g: Math.round(Number(parsed.fat_g) || 0),
    meal_type: parsed.meal_type || inferMealType(),
  };
}

export async function analyzeFoodFromText(
  description: string
): Promise<FoodAnalysisResult> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        {
          role: "user",
          content: `Analyze this food: "${description}". Current time meal guess: ${inferMealType()}.`,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from OpenAI");

  return parseAnalysisResponse(content);
}

export async function analyzeFoodFromImage(
  base64: string
): Promise<FoodAnalysisResult> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Identify the food in this image and estimate its nutrition. Current time meal guess: ${inferMealType()}.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64}` },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from OpenAI");

  return parseAnalysisResponse(content);
}
