#!/usr/bin/env npx tsx

import "dotenv/config";
import { Command } from "commander";
import { promises as fs } from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";

const program = new Command();

program
  .name("split-pdf")
  .description("Split a PDF into smaller chunks by page ranges")
  .requiredOption("-f, --file <path>", "Path to PDF file")
  .requiredOption(
    "-r, --ranges <ranges>",
    "Comma-separated page ranges (e.g., '1-100,101-200,201-300')"
  )
  .option("-o, --output <dir>", "Output directory", "./books/chunks")
  .parse();

const options = program.opts();

async function main() {
  const pdfPath = path.resolve(options.file);
  const outputDir = path.resolve(options.output);
  const rangesStr = options.ranges as string;

  console.log("\n📄 PDF Splitter");
  console.log("=".repeat(50));
  console.log(`Input: ${pdfPath}`);
  console.log(`Output dir: ${outputDir}`);
  console.log(`Ranges: ${rangesStr}`);
  console.log("=".repeat(50));

  // Parse ranges
  const ranges: Array<{ start: number; end: number }> = [];
  for (const range of rangesStr.split(",")) {
    const [start, end] = range.trim().split("-").map(Number);
    if (isNaN(start) || isNaN(end) || start > end || start < 1) {
      console.error(`\n❌ Invalid range: ${range}`);
      process.exit(1);
    }
    ranges.push({ start, end });
  }

  // Check if file exists
  try {
    await fs.access(pdfPath);
  } catch {
    console.error(`\n❌ File not found: ${pdfPath}`);
    process.exit(1);
  }

  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });

  // Load PDF
  console.log("\n📖 Loading PDF...");
  const pdfBytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();
  console.log(`   Total pages: ${totalPages}`);

  // Validate ranges
  for (const range of ranges) {
    if (range.end > totalPages) {
      console.error(
        `\n❌ Range ${range.start}-${range.end} exceeds total pages (${totalPages})`
      );
      process.exit(1);
    }
  }

  // Split PDF
  const baseName = path.basename(pdfPath, ".pdf");

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    console.log(`\n✂️  Extracting pages ${range.start}-${range.end}...`);

    // Create new PDF with selected pages
    const newPdf = await PDFDocument.create();
    
    // pdf-lib uses 0-based indexing
    const pageIndices = [];
    for (let p = range.start - 1; p < range.end; p++) {
      pageIndices.push(p);
    }

    const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
    for (const page of copiedPages) {
      newPdf.addPage(page);
    }

    // Save
    const outputPath = path.join(
      outputDir,
      `${baseName}_pages_${range.start}-${range.end}.pdf`
    );
    const newPdfBytes = await newPdf.save();
    await fs.writeFile(outputPath, newPdfBytes);

    const sizeMB = (newPdfBytes.length / (1024 * 1024)).toFixed(1);
    console.log(`   ✓ Saved: ${outputPath} (${sizeMB} MB)`);
  }

  console.log("\n✅ Done! PDFs split successfully.");
  console.log(`\nYou can now run ingestion on the smaller chunks.`);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});

