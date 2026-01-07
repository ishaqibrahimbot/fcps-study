#!/usr/bin/env npx tsx

import "dotenv/config";
import { Command } from "commander";
import { promises as fs } from "fs";
import path from "path";
import { db } from "../app/db";
import { books, chapters, papers, questions } from "../app/db/schema";
import { eq } from "drizzle-orm";

const program = new Command();

program
  .name("import-book")
  .description(
    "Import a complete book with chapters and papers from a book map"
  )
  .requiredOption("-m, --map <path>", "Path to book map JSON file")
  .option(
    "-t, --tier <tier>",
    "Default access tier for papers (free or premium)",
    "premium"
  )
  .option("--skip-existing", "Skip book if it already exists")
  .option("--dry-run", "Preview import without writing to database")
  .parse();

const options = program.opts();

interface SectionEntry {
  name: string;
  start: number;
  end: number;
  outputFile?: string;
  status?: "pending" | "completed" | "failed";
  // Explanation fields
  explainedFile?: string;
  explanationStatus?: "pending" | "completed" | "failed";
}

// Get the best available file (prefer explained version)
function getBestFile(section: SectionEntry): string | null {
  // Prefer the explained file if explanations are complete
  if (section.explanationStatus === "completed" && section.explainedFile) {
    return section.explainedFile;
  }
  // Fall back to the raw output file
  if (section.status === "completed" && section.outputFile) {
    return section.outputFile;
  }
  return null;
}

interface ChapterEntry {
  name: string;
  sections: SectionEntry[];
}

interface PaperEntry extends SectionEntry {}

interface BookMap {
  source: string;
  pdfFile?: string;
  description?: string;
  coverImage?: string;
  chapters?: ChapterEntry[];
  papers?: PaperEntry[]; // Standalone papers (no chapter)
}

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
  questions: ImportedQuestion[];
}

async function loadPaperFromFile(
  filePath: string
): Promise<ImportedPaper | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`   ⚠️  Failed to load: ${filePath}`);
    return null;
  }
}

async function main() {
  const mapPath = path.resolve(options.map);
  const accessTier = options.tier as "free" | "premium";
  const skipExisting = options.skipExisting || false;
  const isDryRun = options.dryRun || false;

  // Validate tier
  if (!["free", "premium"].includes(accessTier)) {
    console.error(
      `\n❌ Invalid tier: ${accessTier}. Must be 'free' or 'premium'.`
    );
    process.exit(1);
  }

  console.log("\n📚 Book Import");
  console.log("=".repeat(50));
  console.log(`Map file: ${mapPath}`);
  console.log(`Access Tier: ${accessTier}`);
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log("=".repeat(50));

  // Check for database connection
  if (!process.env.DATABASE_URL) {
    console.error("\n❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  // Read book map
  let bookMap: BookMap;
  try {
    const content = await fs.readFile(mapPath, "utf-8");
    bookMap = JSON.parse(content);
  } catch (error) {
    console.error(`\n❌ Failed to read map file: ${mapPath}`);
    process.exit(1);
  }

  // Validate structure
  if (!bookMap.source) {
    console.error("\n❌ Invalid book map: missing 'source' field");
    process.exit(1);
  }

  const hasChapters = bookMap.chapters && bookMap.chapters.length > 0;
  const hasPapers = bookMap.papers && bookMap.papers.length > 0;

  if (!hasChapters && !hasPapers) {
    console.error("\n❌ Invalid book map: no chapters or papers found");
    process.exit(1);
  }

  // Count total sections/papers to import
  let totalPapers = 0;
  if (hasChapters) {
    for (const chapter of bookMap.chapters!) {
      totalPapers += chapter.sections.filter(
        (s) => getBestFile(s) !== null
      ).length;
    }
  }
  if (hasPapers) {
    totalPapers += bookMap.papers!.filter(
      (p) => getBestFile(p) !== null
    ).length;
  }

  console.log(`\n📖 Book: ${bookMap.source}`);
  console.log(`📑 Chapters: ${bookMap.chapters?.length || 0}`);
  console.log(`📄 Papers ready to import: ${totalPapers}`);

  if (totalPapers === 0) {
    console.error(
      "\n❌ No completed papers found. Run ingest-book first to extract questions."
    );
    process.exit(1);
  }

  if (isDryRun) {
    console.log("\n📋 DRY RUN - Would import:");

    if (hasChapters) {
      for (const chapter of bookMap.chapters!) {
        console.log(`\n   📁 Chapter: ${chapter.name}`);
        for (const section of chapter.sections) {
          const file = getBestFile(section);
          if (file) {
            const hasExplanations = section.explanationStatus === "completed";
            const badge = hasExplanations ? "✨" : "📄";
            console.log(`      ${badge} ${section.name} (${file})`);
          }
        }
      }
    }

    if (hasPapers) {
      console.log(`\n   📁 Standalone Papers:`);
      for (const paper of bookMap.papers!) {
        const file = getBestFile(paper);
        if (file) {
          const hasExplanations = paper.explanationStatus === "completed";
          const badge = hasExplanations ? "✨" : "📄";
          console.log(`      ${badge} ${paper.name} (${file})`);
        }
      }
    }

    console.log("\n✅ Dry run complete. Remove --dry-run to import.");
    process.exit(0);
  }

  // Check if book already exists
  if (skipExisting) {
    const existingBook = await db.query.books.findFirst({
      where: (b, { eq }) => eq(b.name, bookMap.source),
    });

    if (existingBook) {
      console.log(`\n⏭️  Book "${bookMap.source}" already exists. Skipping.`);
      process.exit(0);
    }
  }

  // Create book
  console.log("\n💾 Creating book...");
  const [insertedBook] = await db
    .insert(books)
    .values({
      name: bookMap.source,
      description: bookMap.description || null,
      coverImage: bookMap.coverImage || null,
      accessTier,
    })
    .returning();

  console.log(
    `   ✓ Created book: ${insertedBook.name} (ID: ${insertedBook.id})`
  );

  let importedCount = 0;
  let failedCount = 0;

  // Import chapters and their sections
  if (hasChapters) {
    for (
      let chapterIdx = 0;
      chapterIdx < bookMap.chapters!.length;
      chapterIdx++
    ) {
      const chapterData = bookMap.chapters![chapterIdx];

      console.log(`\n📁 Chapter: ${chapterData.name}`);

      // Create chapter
      const [insertedChapter] = await db
        .insert(chapters)
        .values({
          bookId: insertedBook.id,
          name: chapterData.name,
          orderIndex: chapterIdx,
        })
        .returning();

      console.log(`   ✓ Created chapter (ID: ${insertedChapter.id})`);

      // Import sections as papers
      for (
        let sectionIdx = 0;
        sectionIdx < chapterData.sections.length;
        sectionIdx++
      ) {
        const section = chapterData.sections[sectionIdx];

        const fileToImport = getBestFile(section);
        if (!fileToImport) {
          console.log(`   ⏭️  Skipping ${section.name} (not completed)`);
          continue;
        }

        const hasExplanations = section.explanationStatus === "completed";
        const badge = hasExplanations ? "✨" : "📄";
        console.log(
          `   ${badge} Importing: ${section.name}${hasExplanations ? " (with explanations)" : ""}`
        );

        // Load paper data from JSON file
        const paperData = await loadPaperFromFile(fileToImport);
        if (!paperData) {
          failedCount++;
          continue;
        }

        // Create paper
        const [insertedPaper] = await db
          .insert(papers)
          .values({
            name: section.name,
            source: bookMap.source,
            bookId: insertedBook.id,
            chapterId: insertedChapter.id,
            orderIndex: sectionIdx,
            questionCount: paperData.questions.length,
            accessTier,
          })
          .returning();

        // Insert questions
        if (paperData.questions.length > 0) {
          await db.insert(questions).values(
            paperData.questions.map((q, idx) => ({
              paperId: insertedPaper.id,
              questionText: q.questionText,
              choices: q.choices,
              correctChoice: q.correctChoice ?? 0,
              explanation: q.explanation || null,
              orderIndex: q.orderIndex ?? idx,
            }))
          );
        }

        console.log(
          `      ✓ Paper ID: ${insertedPaper.id}, Questions: ${paperData.questions.length}`
        );
        importedCount++;
      }
    }
  }

  // Import standalone papers (no chapter)
  if (hasPapers) {
    console.log(`\n📁 Standalone Papers`);

    for (let paperIdx = 0; paperIdx < bookMap.papers!.length; paperIdx++) {
      const paperEntry = bookMap.papers![paperIdx];

      const fileToImport = getBestFile(paperEntry);
      if (!fileToImport) {
        console.log(`   ⏭️  Skipping ${paperEntry.name} (not completed)`);
        continue;
      }

      const hasExplanations = paperEntry.explanationStatus === "completed";
      const badge = hasExplanations ? "✨" : "📄";
      console.log(
        `   ${badge} Importing: ${paperEntry.name}${hasExplanations ? " (with explanations)" : ""}`
      );

      // Load paper data from JSON file
      const paperData = await loadPaperFromFile(fileToImport);
      if (!paperData) {
        failedCount++;
        continue;
      }

      // Create paper (no chapter, just book)
      const [insertedPaper] = await db
        .insert(papers)
        .values({
          name: paperEntry.name,
          source: bookMap.source,
          bookId: insertedBook.id,
          chapterId: null,
          orderIndex: paperIdx,
          questionCount: paperData.questions.length,
          accessTier,
        })
        .returning();

      // Insert questions
      if (paperData.questions.length > 0) {
        await db.insert(questions).values(
          paperData.questions.map((q, idx) => ({
            paperId: insertedPaper.id,
            questionText: q.questionText,
            choices: q.choices,
            correctChoice: q.correctChoice ?? 0,
            explanation: q.explanation || null,
            orderIndex: q.orderIndex ?? idx,
          }))
        );
      }

      console.log(
        `      ✓ Paper ID: ${insertedPaper.id}, Questions: ${paperData.questions.length}`
      );
      importedCount++;
    }
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log("📊 IMPORT SUMMARY");
  console.log(`${"=".repeat(50)}`);
  console.log(`📚 Book: ${insertedBook.name} (ID: ${insertedBook.id})`);
  console.log(`✅ Imported: ${importedCount} papers`);
  console.log(`❌ Failed: ${failedCount} papers`);

  if (failedCount > 0) {
    console.log("\n⚠️  Some papers failed to import. Check the output files.");
  }

  console.log("\n✅ Import complete!");
  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  if (err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
