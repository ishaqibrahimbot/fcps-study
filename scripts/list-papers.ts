#!/usr/bin/env npx tsx

import "dotenv/config";
import { db } from "../app/db";
import { papers, questions } from "../app/db/schema";
import { eq, isNull } from "drizzle-orm";

async function main() {
  const allPapers = await db.select().from(papers);
  console.log("Papers in database:", allPapers.length);

  for (const p of allPapers) {
    const allQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.paperId, p.id));

    const withExplanations = allQuestions.filter(
      (q) => q.explanation !== null
    ).length;
    const withoutExplanations = allQuestions.filter(
      (q) => q.explanation === null
    );

    console.log(`  - ID: ${p.id} "${p.name}"`);
    console.log(
      `    Questions: ${allQuestions.length}, With explanations: ${withExplanations}`
    );

    // Show questions without explanations
    if (withoutExplanations.length > 0) {
      console.log(`\n    Questions WITHOUT explanations:`);
      withoutExplanations.forEach((q) => {
        console.log(
          `      [${q.orderIndex}] correctChoice: ${q.correctChoice}, choices: ${q.choices.length}`
        );
        console.log(`          "${q.questionText.substring(0, 70)}..."`);
      });
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
