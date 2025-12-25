import { GoogleGenAI } from "@google/genai";

// Token usage tracking
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface GeminiResponse<T> {
  data: T;
  usage: TokenUsage;
}

// Gemini 2.5 Flash pricing (as of late 2024)
// Input: $0.075 per 1M tokens, Output: $0.30 per 1M tokens
const PRICE_PER_1M_INPUT_TOKENS = 0.3;
const PRICE_PER_1M_OUTPUT_TOKENS = 2.5;

export function estimateCost(usage: TokenUsage): number {
  const inputCost =
    (usage.promptTokens / 1_000_000) * PRICE_PER_1M_INPUT_TOKENS;
  const outputCost =
    (usage.completionTokens / 1_000_000) * PRICE_PER_1M_OUTPUT_TOKENS;
  return inputCost + outputCost;
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

class GeminiClient {
  private ai: GoogleGenAI;
  private modelName = "gemini-2.5-flash";
  private cumulativeUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  getCumulativeUsage(): TokenUsage {
    return { ...this.cumulativeUsage };
  }

  getCumulativeCost(): number {
    return estimateCost(this.cumulativeUsage);
  }

  resetUsage(): void {
    this.cumulativeUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }

  private updateUsage(usage: TokenUsage): void {
    this.cumulativeUsage.promptTokens += usage.promptTokens;
    this.cumulativeUsage.completionTokens += usage.completionTokens;
    this.cumulativeUsage.totalTokens += usage.totalTokens;
  }

  async analyzeImage<T>(
    imageBase64: string,
    mimeType: string,
    prompt: string
  ): Promise<GeminiResponse<T>> {
    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: imageBase64,
                mimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "";

    // Extract usage metadata
    const usageMetadata = response.usageMetadata;
    const usage: TokenUsage = {
      promptTokens: usageMetadata?.promptTokenCount || 0,
      completionTokens: usageMetadata?.candidatesTokenCount || 0,
      totalTokens: usageMetadata?.totalTokenCount || 0,
    };

    this.updateUsage(usage);

    // Parse JSON response
    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      throw new Error(`Failed to parse Gemini response as JSON: ${text}`);
    }

    return { data, usage };
  }

  async analyzeMultipleImages<T>(
    images: Array<{ base64: string; mimeType: string }>,
    prompt: string
  ): Promise<GeminiResponse<T>> {
    const parts: Array<
      { text: string } | { inlineData: { data: string; mimeType: string } }
    > = [{ text: prompt }];

    for (const img of images) {
      parts.push({
        inlineData: {
          data: img.base64,
          mimeType: img.mimeType,
        },
      });
    }

    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "";

    const usageMetadata = response.usageMetadata;
    const usage: TokenUsage = {
      promptTokens: usageMetadata?.promptTokenCount || 0,
      completionTokens: usageMetadata?.candidatesTokenCount || 0,
      totalTokens: usageMetadata?.totalTokenCount || 0,
    };

    this.updateUsage(usage);

    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      throw new Error(`Failed to parse Gemini response as JSON: ${text}`);
    }

    return { data, usage };
  }

  async generateText(prompt: string): Promise<GeminiResponse<string>> {
    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    const text = response.text || "";

    const usageMetadata = response.usageMetadata;
    const usage: TokenUsage = {
      promptTokens: usageMetadata?.promptTokenCount || 0,
      completionTokens: usageMetadata?.candidatesTokenCount || 0,
      totalTokens: usageMetadata?.totalTokenCount || 0,
    };

    this.updateUsage(usage);

    return { data: text, usage };
  }

  async generateJson<T>(prompt: string): Promise<GeminiResponse<T>> {
    const response = await this.ai.models.generateContent({
      model: this.modelName,
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

    const usageMetadata = response.usageMetadata;
    const usage: TokenUsage = {
      promptTokens: usageMetadata?.promptTokenCount || 0,
      completionTokens: usageMetadata?.candidatesTokenCount || 0,
      totalTokens: usageMetadata?.totalTokenCount || 0,
    };

    this.updateUsage(usage);

    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      // Try to fix common issues with Gemini JSON responses
      const sanitized = sanitizeJsonResponse(text);
      try {
        data = JSON.parse(sanitized) as T;
      } catch {
        throw new Error(
          `Failed to parse Gemini response as JSON: ${text.substring(0, 500)}...`
        );
      }
    }

    return { data, usage };
  }
}

/**
 * Sanitize JSON response from Gemini that may contain:
 * - Literal newlines inside string values (should be \n)
 * - Markdown code blocks around the JSON
 * - Trailing content after the JSON
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
  // We need to find strings and escape newlines within them
  // Strategy: Process character by character, tracking if we're inside a string
  let result = "";
  let inString = false;
  let i = 0;

  while (i < cleaned.length) {
    const char = cleaned[i];

    if (char === '"' && (i === 0 || cleaned[i - 1] !== "\\")) {
      // Toggle string state (unescaped quote)
      inString = !inString;
      result += char;
    } else if (inString) {
      // Inside a string - escape problematic characters
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

// Singleton instance
let client: GeminiClient | null = null;

export function getGeminiClient(): GeminiClient {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    client = new GeminiClient(apiKey);
  }
  return client;
}

export type { TokenUsage, GeminiResponse };
export { GeminiClient };
