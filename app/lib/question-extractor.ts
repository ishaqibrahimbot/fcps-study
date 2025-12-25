import { getGeminiClient, type TokenUsage } from "./gemini-client";
import { convertPdfPagesToImages, type PageImage } from "./pdf-processor";

export interface ExtractedQuestion {
  questionText: string;
  choices: string[];
  correctChoice: number | null; // 0-based index, null if not marked
  pageNumber: number;
  questionNumber?: number; // Original question number on the page if available
}

export interface PageExtractionResult {
  pageNumber: number;
  questions: ExtractedQuestion[];
  usage: TokenUsage;
}

export interface PaperExtractionResult {
  questions: ExtractedQuestion[];
  totalUsage: TokenUsage;
  pagesProcessed: number;
}

const QUESTION_EXTRACTION_PROMPT = `Extract all MCQ (multiple choice) questions from this exam page.

For each question, provide:
- questionText: The complete question text
- choices: Array of all answer options (usually A, B, C, D, E). Include the full text of each option, NOT the letter prefix.
- correctChoice: The 0-based index of the correct answer if marked/highlighted on the page, or null if not indicated

Important:
- Extract EVERY question visible on the page
- If a question continues from a previous page, extract whatever is visible
- Choices should be the actual text, not "A", "B", etc.
- correctChoice is 0 for first option, 1 for second, etc.
- If the correct answer is circled, highlighted, or marked, identify it
- If no answer is marked, set correctChoice to null

Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "questionText": "Which structure passes through the foramen magnum?",
      "choices": ["Internal carotid artery", "Medulla oblongata", "Glossopharyngeal nerve", "Vertebral artery only"],
      "correctChoice": 1
    }
  ]
}

If no questions are found on this page, return: { "questions": [] }`;

interface GeminiQuestionResponse {
  questions: Array<{
    questionText: string;
    choices: string[];
    correctChoice: number | null;
  }>;
}

/**
 * Extract questions from a single page image
 */
export async function extractQuestionsFromPage(
  pageImage: PageImage
): Promise<PageExtractionResult> {
  const client = getGeminiClient();

  const { data, usage } = await client.analyzeImage<GeminiQuestionResponse>(
    pageImage.base64,
    pageImage.mimeType,
    QUESTION_EXTRACTION_PROMPT
  );

  const questions: ExtractedQuestion[] = (data.questions || []).map((q, idx) => ({
    questionText: q.questionText,
    choices: q.choices,
    correctChoice: q.correctChoice,
    pageNumber: pageImage.pageNumber,
    questionNumber: idx + 1,
  }));

  return {
    pageNumber: pageImage.pageNumber,
    questions,
    usage,
  };
}

/**
 * Extract questions from multiple pages with progress callback
 */
export async function extractQuestionsFromPages(
  pdfPath: string,
  startPage: number,
  endPage: number,
  onProgress?: (current: number, total: number, pageQuestions: number) => void
): Promise<PaperExtractionResult> {
  const totalPages = endPage - startPage + 1;
  const allQuestions: ExtractedQuestion[] = [];
  const totalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  // Process pages one at a time to track progress
  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    const pageImages = await convertPdfPagesToImages(pdfPath, [pageNum]);
    
    if (pageImages.length === 0) {
      console.warn(`Failed to convert page ${pageNum}`);
      continue;
    }

    const result = await extractQuestionsFromPage(pageImages[0]);
    
    // Add questions with correct ordering
    allQuestions.push(...result.questions);
    
    // Accumulate usage
    totalUsage.promptTokens += result.usage.promptTokens;
    totalUsage.completionTokens += result.usage.completionTokens;
    totalUsage.totalTokens += result.usage.totalTokens;

    // Report progress
    if (onProgress) {
      const current = pageNum - startPage + 1;
      onProgress(current, totalPages, result.questions.length);
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Re-number questions sequentially within the paper
  allQuestions.forEach((q, idx) => {
    q.questionNumber = idx + 1;
  });

  return {
    questions: allQuestions,
    totalUsage,
    pagesProcessed: totalPages,
  };
}

/**
 * Validate extracted questions
 */
export function validateQuestions(questions: ExtractedQuestion[]): string[] {
  const errors: string[] = [];

  questions.forEach((q, idx) => {
    if (!q.questionText || q.questionText.trim() === "") {
      errors.push(`Question ${idx + 1}: Empty question text`);
    }
    
    if (!q.choices || q.choices.length < 2) {
      errors.push(`Question ${idx + 1}: Less than 2 choices`);
    }
    
    if (q.correctChoice !== null) {
      if (q.correctChoice < 0 || q.correctChoice >= q.choices.length) {
        errors.push(`Question ${idx + 1}: Invalid correct choice index`);
      }
    }
  });

  return errors;
}

