#!/usr/bin/env npx tsx

/**
 * Seed books and assign existing papers to them based on source
 */

import "dotenv/config";
import { db } from "../app/db";
import { books, papers } from "../app/db/schema";
import { eq, like, or } from "drizzle-orm";

const BOOKS_TO_CREATE = [
  {
    name: "SK 21 Vol 1",
    description: "SK Book Series - 2021 Volume 1",
    sourcePatterns: ["SK 21", "SK21", "SK-21"],
    orderIndex: 0,
  },
  {
    name: "SK 19 Vol 1", 
    description: "SK Book Series - 2019 Volume 1",
    sourcePatterns: ["SK 19", "SK19", "SK-19"],
    orderIndex: 1,
  },
];

async function main() {
  console.log("\n📚 Seed Books and Assign Papers");
  console.log("=".repeat(50));

  if (!process.env.DATABASE_URL) {
    console.error("\n❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  // Check existing books
  const existingBooks = await db.select().from(books);
  console.log(`\nExisting books: ${existingBooks.length}`);
  existingBooks.forEach((b) => console.log(`  - ${b.name} (ID: ${b.id})`));

  // Create books
  for (const bookData of BOOKS_TO_CREATE) {
    // Check if already exists
    const existing = existingBooks.find((b) => b.name === bookData.name);
    
    if (existing) {
      console.log(`\n⏭️  Book "${bookData.name}" already exists (ID: ${existing.id})`);
      
      // Still assign papers to this book
      await assignPapersToBook(existing.id, bookData.sourcePatterns);
    } else {
      // Create the book
      console.log(`\n📖 Creating book: ${bookData.name}`);
      
      const [insertedBook] = await db
        .insert(books)
        .values({
          name: bookData.name,
          description: bookData.description,
          orderIndex: bookData.orderIndex,
        })
        .returning();

      console.log(`   ✓ Created book ID: ${insertedBook.id}`);
      
      // Assign papers
      await assignPapersToBook(insertedBook.id, bookData.sourcePatterns);
    }
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log("📊 SUMMARY");
  console.log(`${"=".repeat(50)}`);

  const allBooks = await db.select().from(books);
  for (const book of allBooks) {
    const bookPapers = await db
      .select()
      .from(papers)
      .where(eq(papers.bookId, book.id));
    console.log(`📚 ${book.name}: ${bookPapers.length} papers`);
  }

  // Unassigned papers
  const unassignedPapers = await db
    .select()
    .from(papers)
    .where(eq(papers.bookId, null as any));
  
  if (unassignedPapers.length > 0) {
    console.log(`\n📄 Unassigned papers: ${unassignedPapers.length}`);
    unassignedPapers.forEach((p) =>
      console.log(`   - ${p.name} (source: ${p.source})`)
    );
  }

  console.log("\n✅ Done!");
  process.exit(0);
}

async function assignPapersToBook(bookId: number, sourcePatterns: string[]) {
  // Find papers matching any of the source patterns
  const allPapers = await db.select().from(papers);
  
  let assignedCount = 0;
  
  for (const paper of allPapers) {
    // Check if source matches any pattern (case-insensitive)
    const matches = sourcePatterns.some((pattern) =>
      paper.source.toLowerCase().includes(pattern.toLowerCase())
    );

    if (matches && paper.bookId === null) {
      // Assign to book
      await db
        .update(papers)
        .set({ bookId })
        .where(eq(papers.id, paper.id));
      
      assignedCount++;
      console.log(`   📄 Assigned: ${paper.name} (source: ${paper.source})`);
    }
  }

  if (assignedCount === 0) {
    console.log(`   (no matching papers found)`);
  } else {
    console.log(`   ✓ Assigned ${assignedCount} papers`);
  }
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  if (err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});

