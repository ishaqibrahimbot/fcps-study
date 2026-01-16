#!/usr/bin/env npx tsx

/**
 * Script to update explanations for existing questions in the database
 * without recreating papers or questions. This preserves user progress.
 *
 * Usage: npx tsx scripts/update-explanations.ts -m books/map.json
 */

import "dotenv/config";
import { Command } from "commander";
import { promises as fs } from "fs";
import path from "path";
import { db } from "../app/db";
import { papers, questions } from "../app/db/schema";
import { eq, and } from "drizzle-orm";

const program = new Command();

program
  .name("update-explanations")
  .description(
    "Update explanation fields for existing questions in the database"
  )
  .requiredOption("-m, --map <path>", "Path to book map JSON file")
  .option(
    "-c, --chapters <list>",
    "Comma-separated list of chapter names or indices"
  )
  .option("--dry-run", "Preview updates without writing to database")
  .parse();

const options = program.opts();

interface SectionEntry {
  name: string;
  start: number;
  end: number;
  outputFile?: string;
  status?: "pending" | "completed" | "failed";
  explainedFile?: string;
  explanationStatus?: "pending" | "completed" | "failed";
}

interface ChapterEntry {
  name: string;
  sections: SectionEntry[];
}

interface BookMap {
  source: string;
  description?: string;
  pdfFile?: string;
  chapters?: ChapterEntry[];
  papers?: SectionEntry[];
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

// Flatten sections from book map
interface FlatSection {
  chapterName: string | null;
  chapterIndex: number | null;
  section: SectionEntry;
}

function flattenBookMap(bookMap: BookMap): FlatSection[] {
  const flattened: FlatSection[] = [];

  if (bookMap.chapters) {
    for (
      let chapterIdx = 0;
      chapterIdx < bookMap.chapters.length;
      chapterIdx++
    ) {
      const chapter = bookMap.chapters[chapterIdx];
      for (const section of chapter.sections) {
        flattened.push({
          chapterName: chapter.name,
          chapterIndex: chapterIdx,
          section,
        });
      }
    }
  }

  if (bookMap.papers) {
    for (const paper of bookMap.papers) {
      flattened.push({
        chapterName: null,
        chapterIndex: null,
        section: paper,
      });
    }
  }

  return flattened;
}

// Parse chapter filter
function parseChapterFilter(
  filter: string,
  availableChapters: ChapterEntry[]
): Set<number> {
  const indices = new Set<number>();
  const parts = filter.split(",").map((s) => s.trim());

  for (const part of parts) {
    const num = parseInt(part);
    if (!isNaN(num) && num >= 0 && num < availableChapters.length) {
      indices.add(num);
    } else {
      const idx = availableChapters.findIndex(
        (c) => c.name.toLowerCase() === part.toLowerCase()
      );
      if (idx !== -1) {
        indices.add(idx);
      } else {
        console.warn(`⚠️  Chapter not found: "${part}" (skipping)`);
      }
    }
  }

  return indices;
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
  const chaptersFilter = options.chapters as string | undefined;
  const isDryRun = options.dryRun || false;

  console.log("\n📝 Update Explanations");
  console.log("=".repeat(50));
  console.log(`Map file: ${mapPath}`);
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

  console.log(`\n📖 Source: ${bookMap.source}`);

  // Flatten and filter sections
  let allSections = flattenBookMap(bookMap);

  // Filter by chapters if specified
  if (chaptersFilter && bookMap.chapters) {
    const selectedIndices = parseChapterFilter(
      chaptersFilter,
      bookMap.chapters
    );

    if (selectedIndices.size === 0) {
      console.error(
        `\n❌ No valid chapters found in filter: "${chaptersFilter}"`
      );
      console.log("Available chapters:");
      bookMap.chapters.forEach((c, i) => console.log(`  ${i}: ${c.name}`));
      process.exit(1);
    }

    console.log(
      `\n🎯 Filtering to chapters: ${[...selectedIndices].map((i) => `${i} (${bookMap.chapters![i].name})`).join(", ")}`
    );

    allSections = allSections.filter(
      (s) => s.chapterIndex !== null && selectedIndices.has(s.chapterIndex)
    );
  }

  // Filter to only sections with completed explanations
  const sectionsWithExplanations = allSections.filter(
    (s) =>
      s.section.explanationStatus === "completed" && s.section.explainedFile
  );

  console.log(
    `\n📊 Sections with explanations to update: ${sectionsWithExplanations.length}`
  );

  if (sectionsWithExplanations.length === 0) {
    console.error("\n❌ No sections with completed explanations found.");
    console.log("Run explain-book first to generate explanations.");
    process.exit(1);
  }

  let papersUpdated = 0;
  let questionsUpdated = 0;
  let papersNotFound = 0;
  let questionMismatches = 0;

  for (let i = 0; i < sectionsWithExplanations.length; i++) {
    const flatSection = sectionsWithExplanations[i];
    const section = flatSection.section;

    console.log(`\n${"─".repeat(50)}`);
    const chapterLabel = flatSection.chapterName
      ? `[${flatSection.chapterName}] `
      : "";
    console.log(
      `📄 ${i + 1}/${sectionsWithExplanations.length}: ${chapterLabel}${section.name}`
    );

    // Find existing paper in database by name + source
    const existingPaper = await db.query.papers.findFirst({
      where: (p, { eq, and }) =>
        and(eq(p.name, section.name), eq(p.source, bookMap.source)),
    });

    if (!existingPaper) {
      console.log(`   ⚠️  Paper not found in database. Skipping.`);
      papersNotFound++;
      continue;
    }

    console.log(`   Found paper ID: ${existingPaper.id}`);

    // Load explained data from file
    const paperData = await loadPaperFromFile(section.explainedFile!);
    if (!paperData) {
      papersNotFound++;
      continue;
    }

    console.log(`   Questions in file: ${paperData.questions.length}`);

    // Get existing questions for this paper
    const existingQuestions = await db.query.questions.findMany({
      where: (q, { eq }) => eq(q.paperId, existingPaper.id),
    });

    console.log(`   Questions in database: ${existingQuestions.length}`);

    // Create a map of orderIndex -> existing question
    const questionsByOrderIndex = new Map(
      existingQuestions.map((q) => [q.orderIndex, q])
    );

    let sectionUpdated = 0;
    let sectionMismatches = 0;

    for (const fileQuestion of paperData.questions) {
      const existingQuestion = questionsByOrderIndex.get(
        fileQuestion.orderIndex
      );

      if (!existingQuestion) {
        // Question not found by orderIndex
        sectionMismatches++;
        continue;
      }

      // Only update if there's an explanation to set
      if (fileQuestion.explanation) {
        if (!isDryRun) {
          await db
            .update(questions)
            .set({ explanation: fileQuestion.explanation })
            .where(eq(questions.id, existingQuestion.id));
        }
        sectionUpdated++;
      }
    }

    console.log(
      `   ✅ Updated: ${sectionUpdated} | ⚠️  Mismatches: ${sectionMismatches}`
    );

    questionsUpdated += sectionUpdated;
    questionMismatches += sectionMismatches;

    if (sectionUpdated > 0) {
      papersUpdated++;
    }
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log("📊 SUMMARY");
  console.log(`${"=".repeat(50)}`);
  console.log(`📄 Papers updated: ${papersUpdated}`);
  console.log(`📝 Questions updated: ${questionsUpdated}`);
  console.log(`⚠️  Papers not found: ${papersNotFound}`);
  console.log(`⚠️  Question mismatches: ${questionMismatches}`);

  if (isDryRun) {
    console.log("\n🔍 This was a DRY RUN. No changes were made.");
    console.log("Remove --dry-run to apply updates.");
  } else {
    console.log("\n✅ Explanations updated successfully!");
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
