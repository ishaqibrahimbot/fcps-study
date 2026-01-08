#!/usr/bin/env npx tsx

import "dotenv/config";
import { Command } from "commander";
import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";

// Section/Paper entry (can be in a chapter or standalone)
interface SectionEntry {
  name: string;
  start: number;
  end: number;
  outputFile?: string;
  status?: "pending" | "completed" | "failed";
  error?: string;
  completedAt?: string;
}

// Chapter containing sections
interface ChapterEntry {
  name: string;
  sections: SectionEntry[];
}

// Book map structure - supports both hierarchical and flat
interface BookMap {
  source: string;
  description?: string;
  pdfFile?: string;
  // Hierarchical: chapters with sections
  chapters?: ChapterEntry[];
  // Flat: standalone papers (legacy support)
  papers?: SectionEntry[];
}

// Flattened section for processing
interface FlatSection {
  chapterName: string | null;
  chapterIndex: number | null;
  sectionIndex: number;
  section: SectionEntry;
  // Path to update in original map
  mapPath:
    | { type: "chapter"; chapterIdx: number; sectionIdx: number }
    | { type: "paper"; paperIdx: number };
}

const program = new Command();

program
  .name("ingest-book")
  .description("Orchestrate ingestion of multiple papers from a book")
  .requiredOption("-m, --map <path>", "Path to book map JSON file")
  .requiredOption("-p, --pdf <path>", "Path to PDF file")
  .option("-o, --output <dir>", "Output directory for JSON files", "./output")
  .option(
    "--skip-completed",
    "Skip papers that are already marked as completed"
  )
  .option("--section <name>", "Only process a specific section by name")
  .option(
    "-c, --chapters <list>",
    "Comma-separated list of chapter names or indices (e.g., '0,2,4' or 'Physiology,Anatomy')"
  )
  .parse();

const options = program.opts();

// Parse chapter filter - can be indices or names
function parseChapterFilter(
  filter: string,
  availableChapters: ChapterEntry[]
): Set<number> {
  const indices = new Set<number>();
  const parts = filter.split(",").map((s) => s.trim());

  for (const part of parts) {
    // Try parsing as number first
    const num = parseInt(part);
    if (!isNaN(num) && num >= 0 && num < availableChapters.length) {
      indices.add(num);
    } else {
      // Try matching by name (case-insensitive)
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

function runIngestScript(
  args: string[]
): Promise<{ success: boolean; outputFile?: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", "scripts/ingest.ts", ...args], {
      stdio: ["inherit", "pipe", "pipe"],
      cwd: process.cwd(),
    });

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

// Flatten chapters/sections into a single list for processing
function flattenBookMap(bookMap: BookMap): FlatSection[] {
  const flattened: FlatSection[] = [];

  // Process chapters with sections
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

  // Process standalone papers (legacy/flat structure)
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

// Update section in book map (in-memory)
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

// Atomic save: re-read fresh state, update only this section, write back
// This prevents race conditions when multiple processes write to the same map file
async function atomicSaveSection(
  mapPath: string,
  flatSection: FlatSection,
  updates: Partial<SectionEntry>
): Promise<void> {
  // Read the latest state from disk
  const freshContent = await fs.readFile(mapPath, "utf-8");
  const freshMap: BookMap = JSON.parse(freshContent);

  // Update only this specific section
  if (flatSection.mapPath.type === "chapter") {
    const { chapterIdx, sectionIdx } = flatSection.mapPath;
    Object.assign(freshMap.chapters![chapterIdx].sections[sectionIdx], updates);
  } else {
    const { paperIdx } = flatSection.mapPath;
    Object.assign(freshMap.papers![paperIdx], updates);
  }

  // Write back to disk
  await fs.writeFile(mapPath, JSON.stringify(freshMap, null, 2));
}

async function main() {
  const mapPath = path.resolve(options.map);
  const pdfPath = path.resolve(options.pdf);
  const outputDir = options.output;
  const skipCompleted = options.skipCompleted || false;
  const specificSection = options.section;
  const chaptersFilter = options.chapters as string | undefined;

  console.log("\n📚 Book Ingestion Orchestrator");
  console.log("=".repeat(50));
  console.log(`Map file: ${mapPath}`);
  console.log(`PDF file: ${pdfPath}`);
  console.log(`Output dir: ${outputDir}`);
  console.log("=".repeat(50));

  // Check if files exist
  try {
    await fs.access(mapPath);
  } catch {
    console.error(`\n❌ Map file not found: ${mapPath}`);
    process.exit(1);
  }

  try {
    await fs.access(pdfPath);
  } catch {
    console.error(`\n❌ PDF file not found: ${pdfPath}`);
    process.exit(1);
  }

  // Read book map
  const mapContent = await fs.readFile(mapPath, "utf-8");
  const bookMap: BookMap = JSON.parse(mapContent);

  // Store PDF path in map for reference
  bookMap.pdfFile = pdfPath;

  // Flatten for processing
  let allSections = flattenBookMap(bookMap);

  // Show structure
  console.log(`\n📖 Source: ${bookMap.source}`);
  if (bookMap.chapters) {
    console.log(`📑 Chapters: ${bookMap.chapters.length}`);
    for (const chapter of bookMap.chapters) {
      console.log(`   └─ ${chapter.name}: ${chapter.sections.length} sections`);
    }
  }
  if (bookMap.papers) {
    console.log(`📄 Standalone papers: ${bookMap.papers.length}`);
  }
  console.log(`📊 Total sections: ${allSections.length}`);

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

    if (allSections.length === 0) {
      console.error(`\n❌ No sections found in selected chapters`);
      process.exit(1);
    }
  }

  // Filter by section name if specified
  if (specificSection) {
    allSections = allSections.filter((s) => s.section.name === specificSection);
    if (allSections.length === 0) {
      console.error(`\n❌ Section not found: "${specificSection}"`);
      process.exit(1);
    }
  }

  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < allSections.length; i++) {
    const flatSection = allSections[i];
    const section = flatSection.section;

    console.log(`\n${"─".repeat(50)}`);
    const chapterLabel = flatSection.chapterName
      ? `[${flatSection.chapterName}] `
      : "";
    console.log(
      `📝 ${i + 1}/${allSections.length}: ${chapterLabel}${section.name}`
    );
    console.log(`   Pages: ${section.start} - ${section.end}`);

    // Check if already completed
    if (skipCompleted && section.status === "completed" && section.outputFile) {
      console.log(`   ⏭️  Skipping (already completed)`);
      skipped++;
      continue;
    }

    // Run ingest script
    const args = [
      "--file",
      pdfPath,
      "--name",
      section.name,
      "--source",
      bookMap.source,
      "--start",
      section.start.toString(),
      "--end",
      section.end.toString(),
      "--dry-run",
      "--output",
      outputDir,
    ];

    console.log(`\n   Running ingestion...\n`);

    const result = await runIngestScript(args);

    if (result.success) {
      const updates = {
        status: "completed" as const,
        outputFile: result.outputFile,
        completedAt: new Date().toISOString(),
        error: undefined,
      };
      // Update in-memory for display purposes
      updateSection(bookMap, flatSection, updates);
      // Atomic save to disk (re-reads fresh state to avoid race conditions)
      await atomicSaveSection(mapPath, flatSection, updates);
      completed++;
      console.log(`\n   ✅ Completed: ${section.name}`);
    } else {
      const updates = {
        status: "failed" as const,
        error: result.error,
      };
      updateSection(bookMap, flatSection, updates);
      await atomicSaveSection(mapPath, flatSection, updates);
      failed++;
      console.log(`\n   ❌ Failed: ${section.name}`);
      console.log(`   Error: ${result.error}`);
    }

    console.log(`   💾 Map updated`);
  }

  // Final summary
  console.log(`\n${"=".repeat(50)}`);
  console.log("📊 SUMMARY");
  console.log(`${"=".repeat(50)}`);
  console.log(`✅ Completed: ${completed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📄 Total: ${allSections.length}`);

  if (failed > 0) {
    console.log(
      "\n⚠️  Some sections failed. Re-run with --skip-completed to retry only failed ones."
    );
  }

  if (completed > 0) {
    console.log("\n📁 Output files are saved in:", outputDir);
    console.log("📋 Map file updated with output paths:", mapPath);
    console.log("\nNext steps:");
    console.log("1. Review the extracted questions in the output JSON files");
    console.log("2. Run the explanation generator on completed papers");
    console.log(
      "3. Import the book to database: npm run import-book -- -m",
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
