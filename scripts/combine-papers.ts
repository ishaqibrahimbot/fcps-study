#!/usr/bin/env npx tsx

/**
 * Script to combine two JSON files representing parts of the same paper
 * Usage: npx tsx scripts/combine-papers.ts
 */

import * as fs from "fs";
import * as path from "path";

// File paths
const file1Path = path.join(
  process.cwd(),
  "output/SK_19_Vol_1-1766666849619.json"
);
const file2Path = path.join(
  process.cwd(),
  "output/sk_1_part_2-1766668868550.json"
);
const outputPath = path.join(process.cwd(), "output/SK_19_Vol_1-combined.json");

// Read both files
const file1Data = JSON.parse(fs.readFileSync(file1Path, "utf-8"));
const file2Data = JSON.parse(fs.readFileSync(file2Path, "utf-8"));

// Extract questions from file 1 (has papers array structure)
const paper1 = file1Data.papers[0];
const questions1 = paper1.questions.map((q: any, index: number) => ({
  questionText: q.questionText,
  choices: q.choices,
  correctChoice: q.correctChoice,
  orderIndex: index,
}));

// Extract questions from file 2 (flat structure)
const questions2 = file2Data.questions.map((q: any, index: number) => ({
  questionText: q.questionText,
  choices: q.choices,
  correctChoice: q.correctChoice,
  orderIndex: questions1.length + index, // Continue from where file 1 left off
}));

// Combine all questions
const allQuestions = [...questions1, ...questions2];

// Create combined output
const combinedData = {
  name: paper1.name,
  source: file1Data.source,
  startPage: paper1.startPage,
  endPage: file2Data.endPage,
  questions: allQuestions,
  stats: {
    totalQuestions: allQuestions.length,
    pagesProcessed:
      paper1.endPage -
      paper1.startPage +
      1 +
      (file2Data.endPage - file2Data.startPage + 1),
    tokensUsed:
      (file1Data.stats?.totalTokens || paper1.usage?.totalTokens || 0) +
      (file2Data.stats?.tokensUsed || 0),
    estimatedCost: `$${(
      parseFloat(file1Data.stats?.estimatedCost?.replace("$", "") || "0") +
      parseFloat(file2Data.stats?.estimatedCost?.replace("$", "") || "0")
    ).toFixed(4)}`,
  },
};

// Write combined output
fs.writeFileSync(outputPath, JSON.stringify(combinedData, null, 2));

console.log(
  `✅ Combined ${questions1.length} + ${questions2.length} = ${allQuestions.length} questions`
);
console.log(`📁 Output written to: ${outputPath}`);
console.log(`📊 Stats:`);
console.log(`   - Total questions: ${combinedData.stats.totalQuestions}`);
console.log(`   - Pages processed: ${combinedData.stats.pagesProcessed}`);
console.log(`   - Estimated cost: ${combinedData.stats.estimatedCost}`);
