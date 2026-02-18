import * as ImageManipulator from "expo-image-manipulator";
import type { FoodAnalysisResult } from "./types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

function inferMealType(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snack";
  return "dinner";
}

const TEXT_ANALYSIS_PROMPT = `You are a nutrition analyzer specializing in Indian and global foods. Estimate the nutritional content of the described food.
Return ONLY valid JSON with these exact fields (no extra text):
{"food_name":"string","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"meal_type":"string","confidence":"high|medium|low","confidence_score":number,"portion_size":"string","meal_items":["item1","item2"]}

Rules:
- meal_type: one of breakfast, lunch, snack, dinner
- confidence: "high" if common well-known food, "medium" if somewhat ambiguous, "low" if very vague
- confidence_score: 0-100 representing how confident you are in the estimate
- portion_size: estimated portion like "1 plate", "1 bowl", "2 pieces", "1 cup"
- meal_items: break down into individual items if it's a combo/thali/meal
- Be accurate with Indian foods: dal, roti, rice, biryani, dosa, paratha, etc.
- Use standard serving sizes if not specified.`;

const IMAGE_ANALYSIS_PROMPT = `You are a nutrition analyzer specializing in Indian and global foods. Identify ALL food items in this image and estimate total nutritional content.
Return ONLY valid JSON with these exact fields (no extra text):
{"food_name":"string","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"meal_type":"string","confidence":"high|medium|low","confidence_score":number,"portion_size":"string","meal_items":["item1","item2"]}

Rules:
- food_name: main dish name or "Mixed Meal" if multiple items
- meal_type: one of breakfast, lunch, snack, dinner
- confidence: "high" if food is clearly visible, "medium" if partially visible/unclear, "low" if hard to identify
- confidence_score: 0-100 representing how confident you are
- portion_size: estimated portion visible in the image
- meal_items: list EVERY individual food item you can see (e.g. ["rice", "dal", "roti", "sabzi"])
- Be accurate with Indian foods: dal, roti, rice, biryani, dosa, paratha, paneer, chole, etc.
- Estimate based on typical serving sizes visible in the image.`;

function parseAnalysisResponse(raw: string): FoodAnalysisResult {
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
    confidence: parsed.confidence || "medium",
    confidence_score: Math.round(Number(parsed.confidence_score) || 50),
    portion_size: parsed.portion_size || undefined,
    meal_items: Array.isArray(parsed.meal_items) ? parsed.meal_items : undefined,
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
        { role: "system", content: TEXT_ANALYSIS_PROMPT },
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

async function resizeImageBase64(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return result.base64 || "";
  } catch {
    return "";
  }
}

export async function analyzeFoodFromImage(
  base64: string,
  imageUri?: string
): Promise<FoodAnalysisResult> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");

  // Try to resize the image if we have a URI
  let finalBase64 = base64;
  if (imageUri) {
    const resized = await resizeImageBase64(imageUri);
    if (resized) finalBase64 = resized;
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: IMAGE_ANALYSIS_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Identify ALL food items in this image and estimate total nutrition. Current time meal guess: ${inferMealType()}.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${finalBase64}` },
            },
          ],
        },
      ],
      max_tokens: 600,
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
