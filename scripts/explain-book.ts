#!/usr/bin/env npx tsx

import "dotenv/config";
import { Command } from "commander";
import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";

// Section/Paper entry
interface SectionEntry {
  name: string;
  start: number;
  end: number;
  outputFile?: string;
  status?: "pending" | "completed" | "failed";
  error?: string;
  completedAt?: string;
  // Explanation status
  explainedFile?: string;
  explanationStatus?: "pending" | "completed" | "failed";
  explanationCompletedAt?: string;
  explanationError?: string;
}

// Chapter containing sections
interface ChapterEntry {
  name: string;
  sections: SectionEntry[];
}

// Book map structure
interface BookMap {
  source: string;
  description?: string;
  pdfFile?: string;
  chapters?: ChapterEntry[];
  papers?: SectionEntry[];
}

// Flattened section for processing
interface FlatSection {
  chapterName: string | null;
  chapterIndex: number | null;
  sectionIndex: number;
  section: SectionEntry;
  mapPath:
    | { type: "chapter"; chapterIdx: number; sectionIdx: number }
    | { type: "paper"; paperIdx: number };
}

const program = new Command();

program
  .name("explain-book")
  .description(
    "Orchestrate explanation generation for papers extracted from a book"
  )
  .requiredOption("-m, --map <path>", "Path to book map JSON file")
  .option(
    "-c, --chapters <list>",
    "Comma-separated list of chapter names or indices"
  )
  .option("--skip-completed", "Skip sections that already have explanations")
  .option("--section <name>", "Only process a specific section by name")
  .parse();

const options = program.opts();

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

function runExplainScript(
  args: string[]
): Promise<{ success: boolean; outputFile?: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      "npx",
      ["tsx", "scripts/generate-explanations.ts", ...args],
      {
        stdio: ["inherit", "pipe", "pipe"],
        cwd: process.cwd(),
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr?.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("close", (code) => {
      if (code === 0) {
        // Extract output file path from stdout
        const outputMatch = stdout.match(/📁 Output saved to: (.+)/);
        const outputFile = outputMatch ? outputMatch[1].trim() : undefined;
        resolve({ success: true, outputFile });
      } else {
        resolve({
          success: false,
          error: stderr || `Process exited with code ${code}`,
        });
      }
    });

    child.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

// Flatten chapters/sections into a single list
function flattenBookMap(bookMap: BookMap): FlatSection[] {
  const flattened: FlatSection[] = [];

  if (bookMap.chapters) {
    for (
      let chapterIdx = 0;
      chapterIdx < bookMap.chapters.length;
      chapterIdx++
    ) {
      const chapter = bookMap.chapters[chapterIdx];
      for (
        let sectionIdx = 0;
        sectionIdx < chapter.sections.length;
        sectionIdx++
      ) {
        flattened.push({
          chapterName: chapter.name,
          chapterIndex: chapterIdx,
          sectionIndex: sectionIdx,
          section: chapter.sections[sectionIdx],
          mapPath: { type: "chapter", chapterIdx, sectionIdx },
        });
      }
    }
  }

  if (bookMap.papers) {
    for (let paperIdx = 0; paperIdx < bookMap.papers.length; paperIdx++) {
      flattened.push({
        chapterName: null,
        chapterIndex: null,
        sectionIndex: paperIdx,
        section: bookMap.papers[paperIdx],
        mapPath: { type: "paper", paperIdx },
      });
    }
  }

  return flattened;
}

// Update section in book map
function updateSection(
  bookMap: BookMap,
  flatSection: FlatSection,
  updates: Partial<SectionEntry>
): void {
  if (flatSection.mapPath.type === "chapter") {
    const { chapterIdx, sectionIdx } = flatSection.mapPath;
    Object.assign(bookMap.chapters![chapterIdx].sections[sectionIdx], updates);
  } else {
    const { paperIdx } = flatSection.mapPath;
    Object.assign(bookMap.papers![paperIdx], updates);
  }
}

async function main() {
  const mapPath = path.resolve(options.map);
  const chaptersFilter = options.chapters as string | undefined;
  const skipCompleted = options.skipCompleted || false;
  const specificSection = options.section;

  console.log("\n🧠 Book Explanation Orchestrator");
  console.log("=".repeat(50));
  console.log(`Map file: ${mapPath}`);
  console.log(`Skip completed: ${skipCompleted}`);
  console.log("=".repeat(50));

  // Check for API key
  if (!process.env.GEMINI_API_KEY) {
    console.error("\n❌ GEMINI_API_KEY environment variable is not set");
    process.exit(1);
  }

  // Read book map
  let bookMap: BookMap;
  try {
    const content = await fs.readFile(mapPath, "utf-8");
    bookMap = JSON.parse(content);
  } catch {
    console.error(`\n❌ Failed to read map file: ${mapPath}`);
    process.exit(1);
  }

  // Flatten for processing
  let allSections = flattenBookMap(bookMap);

  // Show structure
  console.log(`\n📖 Source: ${bookMap.source}`);
  if (bookMap.chapters) {
    console.log(`📑 Chapters: ${bookMap.chapters.length}`);
  }

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

  // Filter by section name if specified
  if (specificSection) {
    allSections = allSections.filter((s) => s.section.name === specificSection);
    if (allSections.length === 0) {
      console.error(`\n❌ Section not found: "${specificSection}"`);
      process.exit(1);
    }
  }

  // Filter to only sections with completed ingestion
  const sectionsWithOutput = allSections.filter(
    (s) => s.section.status === "completed" && s.section.outputFile
  );

  console.log(`\n📊 Sections with extracted questions: ${sectionsWithOutput.length}`);

  if (sectionsWithOutput.length === 0) {
    console.error("\n❌ No sections with completed ingestion found.");
    console.log("Run ingest-book first to extract questions.");
    process.exit(1);
  }

  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < sectionsWithOutput.length; i++) {
    const flatSection = sectionsWithOutput[i];
    const section = flatSection.section;

    console.log(`\n${"─".repeat(50)}`);
    const chapterLabel = flatSection.chapterName
      ? `[${flatSection.chapterName}] `
      : "";
    console.log(
      `🧠 ${i + 1}/${sectionsWithOutput.length}: ${chapterLabel}${section.name}`
    );
    console.log(`   Input: ${section.outputFile}`);

    // Check if already has explanations
    if (
      skipCompleted &&
      section.explanationStatus === "completed" &&
      section.explainedFile
    ) {
      console.log(`   ⏭️  Skipping (already has explanations)`);
      skipped++;
      continue;
    }

    // Run explanation generator
    const args = [
      "--file",
      section.outputFile!,
      "--resume",
      "--skip-existing",
    ];

    console.log(`\n   Running explanation generator...\n`);

    const result = await runExplainScript(args);

    if (result.success) {
      updateSection(bookMap, flatSection, {
        explanationStatus: "completed",
        explainedFile: result.outputFile,
        explanationCompletedAt: new Date().toISOString(),
        explanationError: undefined,
      });
      completed++;
      console.log(`\n   ✅ Completed: ${section.name}`);
      if (result.outputFile) {
        console.log(`   📁 Output: ${result.outputFile}`);
      }
    } else {
      updateSection(bookMap, flatSection, {
        explanationStatus: "failed",
        explanationError: result.error,
      });
      failed++;
      console.log(`\n   ❌ Failed: ${section.name}`);
      console.log(`   Error: ${result.error}`);
    }

    // Save updated map after each section
    await fs.writeFile(mapPath, JSON.stringify(bookMap, null, 2));
    console.log(`   💾 Map updated`);
  }

  // Final summary
  console.log(`\n${"=".repeat(50)}`);
  console.log("📊 SUMMARY");
  console.log(`${"=".repeat(50)}`);
  console.log(`✅ Completed: ${completed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📄 Total: ${sectionsWithOutput.length}`);

  if (failed > 0) {
    console.log(
      "\n⚠️  Some sections failed. Re-run with --skip-completed to retry."
    );
  }

  if (completed > 0) {
    console.log("\n📋 Map file updated with explanation paths:", mapPath);
    console.log("\nNext step:");
    console.log(
      "Import the book to database: npm run import-book -- -m",
      mapPath
    );
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  if (err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});

