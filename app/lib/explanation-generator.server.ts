import { GoogleGenAI } from "@google/genai";
import type { Question } from "~/db/schema";

interface ExplanationResponse {
  explanation: string;
}

function buildPrompt(question: Question): string {
  const choiceLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const choicesText = question.choices
    .map((choice, idx) => `${choiceLabels[idx]}. ${choice}`)
    .join("\n");

  const correctLabel =
    question.correctChoice !== null
      ? choiceLabels[question.correctChoice]
      : "Unknown";

  return `You are a medical education expert. Generate a clear, concise explanation for this USMLE-style MCQ question.

QUESTION:
${question.questionText}

CHOICES:
${choicesText}

CORRECT ANSWER: ${correctLabel}${question.correctChoice !== null ? `. ${question.choices[question.correctChoice]}` : ""}

Instructions:
1. Explain WHY the correct answer is correct
2. Briefly explain why the other options are incorrect (1-2 sentences each)
3. Include any relevant clinical pearls or high-yield facts
4. Keep the explanation focused and exam-relevant (aim for 150-250 words)
5. Use clear medical terminology

Respond with a JSON object in this exact format:
{
  "explanation": "Your explanation here..."
}`;
}

/**
 * Sanitize JSON response from Gemini that may contain unescaped newlines
 */
function sanitizeJsonResponse(text: string): string {
  let cleaned = text.trim();

  // Remove markdown code blocks if present
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Fix unescaped newlines inside JSON string values
  let result = "";
  let inString = false;
  let i = 0;

  while (i < cleaned.length) {
    const char = cleaned[i];

    if (char === '"' && (i === 0 || cleaned[i - 1] !== "\\")) {
      inString = !inString;
      result += char;
    } else if (inString) {
      if (char === "\n") {
        result += "\\n";
      } else if (char === "\r") {
        result += "\\r";
      } else if (char === "\t") {
        result += "\\t";
      } else {
        result += char;
      }
    } else {
      result += char;
    }
    i++;
  }

  return result;
}

export async function generateExplanation(question: Question): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt(question);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text || "";

  let data: ExplanationResponse;
  try {
    data = JSON.parse(text) as ExplanationResponse;
  } catch {
    // Try to fix common issues with Gemini JSON responses
    const sanitized = sanitizeJsonResponse(text);
    try {
      data = JSON.parse(sanitized) as ExplanationResponse;
    } catch {
      throw new Error(
        `Failed to parse Gemini response: ${text.substring(0, 200)}...`
      );
    }
  }

  return data.explanation;
}
