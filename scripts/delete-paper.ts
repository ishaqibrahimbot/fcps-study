#!/usr/bin/env npx tsx

import "dotenv/config";
import { Command } from "commander";
import { db } from "../app/db";
import { papers, questions, testSessions } from "../app/db/schema";
import { eq } from "drizzle-orm";

const program = new Command();

program
  .name("delete-paper")
  .description("Delete a paper and all its associated data")
  .requiredOption("-i, --id <id>", "Paper ID to delete")
  .parse();

const options = program.opts();

async function main() {
  const paperId = parseInt(options.id);

  // Get paper info
  const [paper] = await db.select().from(papers).where(eq(papers.id, paperId));

  if (!paper) {
    console.log(`❌ Paper with ID ${paperId} not found`);
    process.exit(1);
  }

  console.log(`\n🗑️  Deleting Paper`);
  console.log("=".repeat(50));
  console.log(`ID: ${paper.id}`);
  console.log(`Name: ${paper.name}`);
  console.log(`Questions: ${paper.questionCount}`);
  console.log("=".repeat(50));

  // Delete sessions first (foreign key)
  const deletedSessions = await db
    .delete(testSessions)
    .where(eq(testSessions.paperId, paperId))
    .returning();
  console.log(`   ✓ Deleted ${deletedSessions.length} test sessions`);

  // Delete questions (foreign key)
  const deletedQuestions = await db
    .delete(questions)
    .where(eq(questions.paperId, paperId))
    .returning();
  console.log(`   ✓ Deleted ${deletedQuestions.length} questions`);

  // Delete paper
  await db.delete(papers).where(eq(papers.id, paperId));
  console.log(`   ✓ Deleted paper`);

  console.log(`\n✅ Paper "${paper.name}" deleted successfully`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});

