#!/usr/bin/env npx tsx

import "dotenv/config";
import { Command } from "commander";
import { createInterface } from "readline";
import { promises as fs } from "fs";
import path from "path";

import { extractQuestionsFromPages } from "../app/lib/question-extractor";
import { estimateCost, formatCost } from "../app/lib/gemini-client";
import { getPdfPageCount } from "../app/lib/pdf-processor";
import { db } from "../app/db";
import { papers, questions } from "../app/db/schema";

const program = new Command();

program
  .name("ingest")
  .description("Ingest MCQ questions from a single paper in a PDF")
  .requiredOption("-f, --file <path>", "Path to PDF file")
  .requiredOption("-n, --name <name>", "Paper name")
  .requiredOption(
    "-s, --source <source>",
    "Source name (e.g., 'SK Book Series')"
  )
  .requiredOption("--start <page>", "Start page number (PDF page, 1-indexed)")
  .requiredOption("--end <page>", "End page number (PDF page, 1-indexed)")
  .option("-d, --dry-run", "Preview extraction without saving to database")
  .option("-o, --output <dir>", "Output directory for dry-run JSON", "./output")
  .parse();

const options = program.opts();

// Progress bar helper
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

async function main() {
  const pdfPath = path.resolve(options.file);
  const paperName = options.name;
  const source = options.source;
  const startPage = parseInt(options.start);
  const endPage = parseInt(options.end);
  const isDryRun = options.dryRun || false;
  const outputDir = options.output;

  console.log("\n🔍 PDF Paper Ingestion");
  console.log("=".repeat(50));
  console.log(`File: ${pdfPath}`);
  console.log(`Paper: ${paperName}`);
  console.log(`Source: ${source}`);
  console.log(
    `Pages: ${startPage} - ${endPage} (${endPage - startPage + 1} pages)`
  );
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log("=".repeat(50));

  // Check if file exists
  try {
    await fs.access(pdfPath);
  } catch {
    console.error(`\n❌ File not found: ${pdfPath}`);
    process.exit(1);
  }

  // Check for API key
  if (!process.env.GEMINI_API_KEY) {
    console.error("\n❌ GEMINI_API_KEY environment variable is not set");
    process.exit(1);
  }

  // Validate page numbers
  const totalPages = await getPdfPageCount(pdfPath);
  console.log(`\n📄 PDF has ${totalPages} total pages`);

  if (startPage < 1 || startPage > totalPages) {
    console.error(
      `\n❌ Invalid start page: ${startPage}. Must be between 1 and ${totalPages}`
    );
    process.exit(1);
  }

  if (endPage < startPage || endPage > totalPages) {
    console.error(
      `\n❌ Invalid end page: ${endPage}. Must be between ${startPage} and ${totalPages}`
    );
    process.exit(1);
  }

  // Extract questions
  console.log(
    `\n📝 Extracting questions from pages ${startPage}-${endPage}...\n`
  );

  let questionsFound = 0;
  const result = await extractQuestionsFromPages(
    pdfPath,
    startPage,
    endPage,
    (current, total, pageQuestions) => {
      questionsFound += pageQuestions;
      process.stdout.write(
        `\r   ${progressBar(current, total)} pages | ${questionsFound} questions found`
      );
    }
  );

  console.log("\n");

  // Build result object
  const paperResult = {
    name: paperName,
    source,
    startPage,
    endPage,
    questions: result.questions.map((q, idx) => ({
      questionText: q.questionText,
      choices: q.choices,
      correctChoice: q.correctChoice,
      orderIndex: idx,
    })),
    stats: {
      totalQuestions: result.questions.length,
      pagesProcessed: result.pagesProcessed,
      tokensUsed: result.totalUsage.totalTokens,
      estimatedCost: formatCost(estimateCost(result.totalUsage)),
    },
  };

  // Summary
  console.log("=".repeat(50));
  console.log(`Paper: ${paperName}`);
  console.log(
    `Pages: ${startPage}-${endPage} (${result.pagesProcessed} pages processed)`
  );
  console.log(`Questions extracted: ${result.questions.length}`);
  console.log(
    `API Usage: ${result.totalUsage.totalTokens.toLocaleString()} tokens`
  );
  console.log(`Estimated Cost: ${formatCost(estimateCost(result.totalUsage))}`);
  console.log("=".repeat(50));

  if (result.questions.length > 0) {
    console.log(
      `\nSample question: "${result.questions[0].questionText.substring(0, 80)}..."`
    );
  }

  if (isDryRun) {
    // Save to JSON file
    await fs.mkdir(outputDir, { recursive: true });
    const timestamp = Date.now();
    const safeFileName = paperName.replace(/[^a-zA-Z0-9]/g, "_");
    const outputPath = path.join(
      outputDir,
      `${safeFileName}-${timestamp}.json`
    );

    await fs.writeFile(outputPath, JSON.stringify(paperResult, null, 2));
    console.log(`\n📁 Output saved to: ${outputPath}`);
    console.log(`\nTo import this to the database, run:`);
    console.log(`   npm run import -- --file "${outputPath}"`);
  } else {
    // Save to database
    console.log("\n💾 Saving to database...");

    const [insertedPaper] = await db
      .insert(papers)
      .values({
        name: paperName,
        source,
        questionCount: result.questions.length,
      })
      .returning();

    if (result.questions.length > 0) {
      await db.insert(questions).values(
        result.questions.map((q, idx) => ({
          paperId: insertedPaper.id,
          questionText: q.questionText,
          choices: q.choices,
          correctChoice: q.correctChoice ?? 0,
          explanation: null,
          orderIndex: idx,
        }))
      );
    }

    console.log(
      `\n✅ Saved: ${paperName} with ${result.questions.length} questions`
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  if (err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
