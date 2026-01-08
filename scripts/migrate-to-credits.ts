#!/usr/bin/env npx tsx

/**
 * Migration script: Move existing users to the credits system
 *
 * What this does:
 * 1. Identifies the current "free" paper (if any exists based on old accessTier)
 * 2. For all existing "free" users:
 *    - Set credits = 4
 *    - Auto-unlock the free paper (if one exists)
 * 3. For users with subscriptionStatus = "subscribed":
 *    - Change to "lifetime"
 *
 * Run with: npx tsx scripts/migrate-to-credits.ts
 */

import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db } from "../app/db";
import { users, papers, userUnlockedPapers } from "../app/db/schema";

// Configuration
const CREDITS_FOR_EXISTING_USERS = 4;
const FREE_PAPER_NAME = "Surgery, Anesthesia, Ortho"; // The paper that was previously free

async function main() {
  console.log("\n🔄 Credits System Migration");
  console.log("=".repeat(60));

  // Check for database connection
  if (!process.env.DATABASE_URL) {
    console.error("\n❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  // Step 1: Find the free paper (if any)
  console.log("\n📋 Step 1: Finding the previously free paper...");
  const freePaper = await db.query.papers.findFirst({
    where: eq(papers.name, FREE_PAPER_NAME),
  });

  if (freePaper) {
    console.log(`   Found free paper: "${freePaper.name}" (ID: ${freePaper.id})`);
  } else {
    console.log(`   No paper named "${FREE_PAPER_NAME}" found. Will skip auto-unlock.`);
  }

  // Step 2: Get all users
  console.log("\n📋 Step 2: Fetching all users...");
  const allUsers = await db.query.users.findMany();
  console.log(`   Found ${allUsers.length} users`);

  // Step 3: Process each user
  console.log("\n📋 Step 3: Processing users...");

  let freeUsersUpdated = 0;
  let subscribedUsersConverted = 0;
  let papersUnlocked = 0;
  let alreadyUnlocked = 0;

  for (const user of allUsers) {
    // Check current subscription status
    // Note: "subscribed" was the old status, now it should be "lifetime"
    const currentStatus = user.subscriptionStatus as string;

    if (currentStatus === "subscribed") {
      // Convert "subscribed" to "lifetime"
      await db
        .update(users)
        .set({
          subscriptionStatus: "lifetime",
        })
        .where(eq(users.id, user.id));

      console.log(`   ✨ ${user.email}: subscribed → lifetime`);
      subscribedUsersConverted++;
    } else if (currentStatus === "free") {
      // Give 4 credits to free users
      await db
        .update(users)
        .set({
          credits: CREDITS_FOR_EXISTING_USERS,
        })
        .where(eq(users.id, user.id));

      freeUsersUpdated++;

      // Auto-unlock the free paper if it exists
      if (freePaper) {
        // Check if already unlocked
        const existing = await db.query.userUnlockedPapers.findFirst({
          where: sql`${userUnlockedPapers.userId} = ${user.id} AND ${userUnlockedPapers.paperId} = ${freePaper.id}`,
        });

        if (!existing) {
          await db.insert(userUnlockedPapers).values({
            userId: user.id,
            paperId: freePaper.id,
          });
          papersUnlocked++;
          console.log(`   🎟️ ${user.email}: +${CREDITS_FOR_EXISTING_USERS} credits, unlocked "${freePaper.name}"`);
        } else {
          alreadyUnlocked++;
          console.log(`   🎟️ ${user.email}: +${CREDITS_FOR_EXISTING_USERS} credits (paper already unlocked)`);
        }
      } else {
        console.log(`   🎟️ ${user.email}: +${CREDITS_FOR_EXISTING_USERS} credits`);
      }
    } else {
      // Already "lifetime" or unknown status
      console.log(`   ⏭️ ${user.email}: skipped (status: ${currentStatus})`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Migration Summary:");
  console.log(`   Total users processed: ${allUsers.length}`);
  console.log(`   Free users given ${CREDITS_FOR_EXISTING_USERS} credits: ${freeUsersUpdated}`);
  console.log(`   Subscribed users converted to lifetime: ${subscribedUsersConverted}`);
  if (freePaper) {
    console.log(`   Papers auto-unlocked: ${papersUnlocked}`);
    console.log(`   Already unlocked (skipped): ${alreadyUnlocked}`);
  }
  console.log("=".repeat(60));

  console.log("\n✅ Migration complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  console.error(err.stack);
  process.exit(1);
});

