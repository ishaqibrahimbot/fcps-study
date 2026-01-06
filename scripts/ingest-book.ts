#!/usr/bin/env npx tsx

import "dotenv/config";
import { Command } from "commander";
import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";

interface PaperEntry {
  name: string;
  start: number;
  end: number;
  outputFile?: string;
  status?: "pending" | "completed" | "failed";
  error?: string;
  completedAt?: string;
}

interface BookMap {
  source: string;
  pdfFile?: string;
  papers: PaperEntry[];
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
  .option("--paper <name>", "Only process a specific paper by name")
  .parse();

const options = program.opts();

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

async function main() {
  const mapPath = path.resolve(options.map);
  const pdfPath = path.resolve(options.pdf);
  const outputDir = options.output;
  const skipCompleted = options.skipCompleted || false;
  const specificPaper = options.paper;

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

  const totalPapers = bookMap.papers.length;
  console.log(`\n📖 Source: ${bookMap.source}`);
  console.log(`📄 Total papers: ${totalPapers}`);

  // Filter papers if specific paper requested
  let papersToProcess = bookMap.papers;
  if (specificPaper) {
    papersToProcess = bookMap.papers.filter((p) => p.name === specificPaper);
    if (papersToProcess.length === 0) {
      console.error(`\n❌ Paper not found: "${specificPaper}"`);
      console.log("Available papers:");
      bookMap.papers.forEach((p) => console.log(`  - ${p.name}`));
      process.exit(1);
    }
  }

  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < papersToProcess.length; i++) {
    const paper = papersToProcess[i];
    const paperIndex = bookMap.papers.findIndex((p) => p.name === paper.name);

    console.log(`\n${"─".repeat(50)}`);
    console.log(`📝 Paper ${i + 1}/${papersToProcess.length}: ${paper.name}`);
    console.log(`   Pages: ${paper.start} - ${paper.end}`);

    // Check if already completed
    if (skipCompleted && paper.status === "completed" && paper.outputFile) {
      console.log(`   ⏭️  Skipping (already completed)`);
      skipped++;
      continue;
    }

    // Run ingest script
    const args = [
      "--file",
      pdfPath,
      "--name",
      paper.name,
      "--source",
      bookMap.source,
      "--start",
      paper.start.toString(),
      "--end",
      paper.end.toString(),
      "--dry-run",
      "--output",
      outputDir,
    ];

    console.log(`\n   Running: npx tsx scripts/ingest.ts ${args.join(" ")}\n`);

    const result = await runIngestScript(args);

    if (result.success) {
      bookMap.papers[paperIndex].status = "completed";
      bookMap.papers[paperIndex].outputFile = result.outputFile;
      bookMap.papers[paperIndex].completedAt = new Date().toISOString();
      delete bookMap.papers[paperIndex].error;
      completed++;
      console.log(`\n   ✅ Completed: ${paper.name}`);
    } else {
      bookMap.papers[paperIndex].status = "failed";
      bookMap.papers[paperIndex].error = result.error;
      failed++;
      console.log(`\n   ❌ Failed: ${paper.name}`);
      console.log(`   Error: ${result.error}`);
    }

    // Save updated map after each paper
    await fs.writeFile(mapPath, JSON.stringify(bookMap, null, 2));
    console.log(`   💾 Map updated: ${mapPath}`);
  }

  // Final summary
  console.log(`\n${"=".repeat(50)}`);
  console.log("📊 SUMMARY");
  console.log(`${"=".repeat(50)}`);
  console.log(`✅ Completed: ${completed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📄 Total: ${papersToProcess.length}`);

  if (failed > 0) {
    console.log(
      "\n⚠️  Some papers failed. Re-run with --skip-completed to retry only failed papers."
    );
  }

  if (completed > 0) {
    console.log("\n📁 Output files are saved in:", outputDir);
    console.log("📋 Map file updated with output paths:", mapPath);
    console.log("\nNext steps:");
    console.log("1. Review the extracted questions in the output JSON files");
    console.log("2. Run the explanation generator on completed papers");
    console.log(
      "3. Import the papers to the database using: npm run import -- -f <output-file>"
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
