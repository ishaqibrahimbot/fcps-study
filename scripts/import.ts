#!/usr/bin/env npx tsx

import "dotenv/config";
import { Command } from "commander";
import { promises as fs } from "fs";
import path from "path";
import { db } from "../app/db";
import { papers, questions } from "../app/db/schema";

const program = new Command();

program
  .name("import")
  .description("Import extracted questions from JSON file to database")
  .requiredOption(
    "-f, --file <path>",
    "Path to JSON file (from dry-run output)"
  )
  .option(
    "-t, --tier <tier>",
    "Access tier for the paper (free or premium)",
    "premium"
  )
  .option("--book <id>", "Book ID to associate paper with")
  .option("--chapter <id>", "Chapter ID to associate paper with")
  .option("--order <index>", "Order index within chapter", "0")
  .option("--skip-existing", "Skip if paper with same name already exists")
  .parse();

const options = program.opts();

interface ImportedQuestion {
  questionText: string;
  choices: string[];
  correctChoice: number | null;
  orderIndex: number;
  explanation?: string | null;
}

interface ImportedPaper {
  name: string;
  source: string;
  startPage?: number;
  endPage?: number;
  questions: ImportedQuestion[];
  stats?: {
    totalQuestions: number;
    pagesProcessed: number;
    tokensUsed: number;
    estimatedCost: string;
  };
}

async function main() {
  const filePath = path.resolve(options.file);
  const accessTier = options.tier as "free" | "premium";
  const bookId = options.book ? parseInt(options.book) : null;
  const chapterId = options.chapter ? parseInt(options.chapter) : null;
  const orderIndex = parseInt(options.order) || 0;
  const skipExisting = options.skipExisting || false;

  // Validate tier
  if (!["free", "premium"].includes(accessTier)) {
    console.error(
      `\n❌ Invalid tier: ${accessTier}. Must be 'free' or 'premium'.`
    );
    process.exit(1);
  }

  console.log("\n📥 Import to Database");
  console.log("=".repeat(50));
  console.log(`File: ${filePath}`);
  console.log(`Access Tier: ${accessTier}`);
  if (bookId) console.log(`Book ID: ${bookId}`);
  if (chapterId) console.log(`Chapter ID: ${chapterId}`);
  if (bookId || chapterId) console.log(`Order Index: ${orderIndex}`);
  console.log("=".repeat(50));

  // Check if file exists
  try {
    await fs.access(filePath);
  } catch {
    console.error(`\n❌ File not found: ${filePath}`);
    process.exit(1);
  }

  // Check for database connection
  if (!process.env.DATABASE_URL) {
    console.error("\n❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  // Read and parse JSON
  const fileContent = await fs.readFile(filePath, "utf-8");
  let data: ImportedPaper;

  try {
    data = JSON.parse(fileContent);
  } catch {
    console.error("\n❌ Invalid JSON file");
    process.exit(1);
  }

  // Validate structure
  if (!data.name || !data.source || !Array.isArray(data.questions)) {
    console.error(
      "\n❌ Invalid file structure. Expected: { name, source, questions: [] }"
    );
    process.exit(1);
  }

  console.log(`\nPaper: ${data.name}`);
  console.log(`Source: ${data.source}`);
  console.log(`Questions: ${data.questions.length}`);

  if (skipExisting) {
    // Check if paper already exists (global check)
    const existing = await db.query.papers.findFirst({
      where: (p, { eq }) => eq(p.name, data.name),
    });

    if (existing) {
      console.log(`\n⏭️  Paper "${data.name}" already exists. Skipping.`);
      process.exit(0);
    }
  }

  // Insert paper (global, no userId)
  console.log("\n💾 Saving to database...");

  const [insertedPaper] = await db
    .insert(papers)
    .values({
      name: data.name,
      source: data.source,
      questionCount: data.questions.length,
      accessTier,
      bookId,
      chapterId,
      orderIndex,
    })
    .returning();

  const hierarchy = chapterId
    ? `Chapter ${chapterId}`
    : bookId
      ? `Book ${bookId}`
      : "Standalone";
  console.log(
    `   ✓ Created paper: ${insertedPaper.name} (ID: ${insertedPaper.id}, Tier: ${accessTier}, ${hierarchy})`
  );

  // Insert questions
  if (data.questions.length > 0) {
    const questionsWithExplanations = data.questions.filter(
      (q) => q.explanation
    ).length;

    await db.insert(questions).values(
      data.questions.map((q, idx) => ({
        paperId: insertedPaper.id,
        questionText: q.questionText,
        choices: q.choices,
        correctChoice: q.correctChoice ?? 0,
        explanation: q.explanation || null,
        orderIndex: q.orderIndex ?? idx,
      }))
    );
    console.log(
      `   ✓ Inserted ${data.questions.length} questions (${questionsWithExplanations} with explanations)`
    );
  }

  console.log(`\n✅ Import complete!`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
