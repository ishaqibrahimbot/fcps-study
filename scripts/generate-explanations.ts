#!/usr/bin/env npx tsx

/**
 * Script to generate explanations for MCQ questions using Gemini 2.5 Flash
 * Usage: npx tsx scripts/generate-explanations.ts --file output/paper.json
 */

import "dotenv/config";
import { Command } from "commander";
import { promises as fs } from "fs";
import path from "path";
import {
  getGeminiClient,
  estimateCost,
  formatCost,
} from "../app/lib/gemini-client";

const program = new Command();

program
  .name("generate-explanations")
  .description("Generate explanations for MCQ questions using Gemini AI")
  .requiredOption("-f, --file <path>", "Path to JSON file with questions")
  .option(
    "-o, --output <path>",
    "Output file path (default: same as input with -explained suffix)"
  )
  .option(
    "-b, --batch-size <n>",
    "Number of questions to process before saving checkpoint",
    "10"
  )
  .option("--resume", "Resume from existing output file if it exists")
  .option("--skip-existing", "Skip questions that already have explanations")
  .parse();

const options = program.opts();

interface Question {
  questionText: string;
  choices: string[];
  correctChoice: number | null;
  orderIndex: number;
  explanation?: string | null;
}

interface PaperData {
  name: string;
  source: string;
  startPage?: number;
  endPage?: number;
  questions: Question[];
  stats?: {
    totalQuestions: number;
    pagesProcessed?: number;
    tokensUsed?: number;
    estimatedCost?: string;
  };
}

interface ExplanationResponse {
  explanation: string;
}

function progressBar(
  current: number,
  total: number,
  width: number = 20
): string {
  const percent = current / total;
  const filled = Math.round(width * percent);
  const empty = width - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${current}/${total}`;
}

function buildPrompt(question: Question): string {
  const choiceLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const choicesText = question.choices
    .map((c, i) => `${choiceLabels[i]}. ${c}`)
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

async function generateExplanation(
  question: Question
): Promise<{ explanation: string; tokensUsed: number }> {
  const client = getGeminiClient();
  const prompt = buildPrompt(question);

  const response = await client.generateJson<ExplanationResponse>(prompt);

  return {
    explanation: response.data.explanation,
    tokensUsed: response.usage.totalTokens,
  };
}

async function saveCheckpoint(
  data: PaperData,
  outputPath: string
): Promise<void> {
  await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
}

async function main() {
  const inputPath = path.resolve(options.file);
  const batchSize = parseInt(options.batchSize);
  const resume = options.resume || false;
  const skipExisting = options.skipExisting || false;

  // Determine output path
  let outputPath: string;
  if (options.output) {
    outputPath = path.resolve(options.output);
  } else {
    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const base = path.basename(inputPath, ext);
    outputPath = path.join(dir, `${base}-explained${ext}`);
  }

  console.log("\n🧠 Generate Explanations");
  console.log("=".repeat(50));
  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Resume: ${resume}`);
  console.log(`Skip existing: ${skipExisting}`);
  console.log("=".repeat(50));

  // Check for API key
  if (!process.env.GEMINI_API_KEY) {
    console.error("\n❌ GEMINI_API_KEY environment variable is not set");
    process.exit(1);
  }

  // Read input file
  let data: PaperData;
  try {
    // Check if we should resume from output file
    if (resume) {
      try {
        await fs.access(outputPath);
        console.log(`\n📂 Resuming from existing output: ${outputPath}`);
        const content = await fs.readFile(outputPath, "utf-8");
        data = JSON.parse(content);
      } catch {
        // Output doesn't exist, read from input
        const content = await fs.readFile(inputPath, "utf-8");
        data = JSON.parse(content);
      }
    } else {
      const content = await fs.readFile(inputPath, "utf-8");
      data = JSON.parse(content);
    }
  } catch (err) {
    console.error(`\n❌ Failed to read file: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`\nPaper: ${data.name}`);
  console.log(`Source: ${data.source}`);
  console.log(`Total questions: ${data.questions.length}`);

  // Determine which questions need explanations
  const questionsToProcess: number[] = [];
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    if (skipExisting && q.explanation) {
      continue;
    }
    // Skip questions without a correct answer
    if (q.correctChoice === null) {
      continue;
    }
    questionsToProcess.push(i);
  }

  const alreadyHaveExplanations =
    data.questions.length - questionsToProcess.length;
  if (alreadyHaveExplanations > 0) {
    console.log(`Already have explanations: ${alreadyHaveExplanations}`);
  }
  console.log(`Questions to process: ${questionsToProcess.length}`);

  if (questionsToProcess.length === 0) {
    console.log("\n✅ All questions already have explanations!");
    process.exit(0);
  }

  // Process questions
  console.log("\n📝 Generating explanations...\n");

  let processed = 0;
  let totalTokens = 0;
  let errors = 0;

  for (const idx of questionsToProcess) {
    const question = data.questions[idx];

    try {
      process.stdout.write(
        `\r   ${progressBar(processed + 1, questionsToProcess.length)} | Tokens: ${totalTokens.toLocaleString()} | Errors: ${errors}`
      );

      const result = await generateExplanation(question);
      data.questions[idx].explanation = result.explanation;
      totalTokens += result.tokensUsed;

      processed++;

      // Save checkpoint every batch
      if (processed % batchSize === 0) {
        await saveCheckpoint(data, outputPath);
        process.stdout.write(` [checkpoint saved]`);
      }
    } catch (err) {
      errors++;
      console.error(
        `\n   ⚠️ Error on question ${idx}: ${(err as Error).message}`
      );
      // Continue with next question
    }
  }

  // Final save
  await saveCheckpoint(data, outputPath);

  // Summary
  const client = getGeminiClient();
  const cost = client.getCumulativeCost();

  console.log("\n\n" + "=".repeat(50));
  console.log("📊 Summary");
  console.log("=".repeat(50));
  console.log(`Questions processed: ${processed}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total tokens used: ${totalTokens.toLocaleString()}`);
  console.log(`Estimated cost: ${formatCost(cost)}`);
  console.log(`\n📁 Output saved to: ${outputPath}`);

  if (errors > 0) {
    console.log(
      `\n⚠️ ${errors} questions failed. Run again with --resume --skip-existing to retry.`
    );
  }

  console.log(
    `\nTo import to database:\n   npm run import -- --file "${outputPath}"`
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
