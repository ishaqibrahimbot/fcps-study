#!/usr/bin/env npx tsx

/**
 * Migration script to set up the access control system.
 * This sets default values for:
 * - accessTier on papers (defaults to 'premium' if not set)
 * - subscriptionStatus on users (defaults to 'free' if not set)
 * - Optionally upgrade a specific user to subscribed status
 *
 * Usage:
 *   npx tsx scripts/migrate-access-system.ts [--upgrade-user <email>] [--dry-run]
 */

import "dotenv/config";
import { Command } from "commander";
import { eq, isNull, or, sql } from "drizzle-orm";
import { db } from "../app/db";
import { papers, users } from "../app/db/schema";

const program = new Command();

program
  .name("migrate-access-system")
  .description("Set up access control system defaults")
  .option(
    "-u, --upgrade-user <email>",
    "Optionally upgrade a specific user to subscribed"
  )
  .option("--dry-run", "Preview changes without making them")
  .parse();

const options = program.opts();

async function main() {
  const upgradeUserEmail = options.upgradeUser as string | undefined;
  const dryRun = options.dryRun || false;

  console.log("\n🔐 Migrate Access Control System");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  if (upgradeUserEmail) {
    console.log(`Upgrade User: ${upgradeUserEmail}`);
  }
  console.log("=".repeat(50));

  // Check for database connection
  if (!process.env.DATABASE_URL) {
    console.error("\n❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  // Check for papers without accessTier set
  const allPapers = await db.select().from(papers);
  const papersNeedingTier = allPapers.filter(
    (p) => p.accessTier !== "free" && p.accessTier !== "premium"
  );

  console.log(`\n📄 Papers Status:`);
  console.log(`   Total papers: ${allPapers.length}`);
  console.log(
    `   Free tier: ${allPapers.filter((p) => p.accessTier === "free").length}`
  );
  console.log(
    `   Premium tier: ${allPapers.filter((p) => p.accessTier === "premium").length}`
  );
  console.log(`   Needs migration: ${papersNeedingTier.length}`);

  if (papersNeedingTier.length > 0) {
    console.log(`\n   Papers to set as premium by default:`);
    papersNeedingTier.forEach((p) => {
      console.log(`   - ${p.name} (ID: ${p.id})`);
    });

    if (!dryRun) {
      for (const paper of papersNeedingTier) {
        await db
          .update(papers)
          .set({ accessTier: "premium" })
          .where(eq(papers.id, paper.id));
      }
      console.log(
        `   ✓ Updated ${papersNeedingTier.length} paper(s) to premium tier`
      );
    }
  }

  // Check for users without subscriptionStatus set
  const allUsers = await db.select().from(users);
  const usersNeedingStatus = allUsers.filter(
    (u) =>
      u.subscriptionStatus !== "free" && u.subscriptionStatus !== "subscribed"
  );

  console.log(`\n👥 Users Status:`);
  console.log(`   Total users: ${allUsers.length}`);
  console.log(
    `   Free users: ${allUsers.filter((u) => u.subscriptionStatus === "free").length}`
  );
  console.log(
    `   Subscribed users: ${allUsers.filter((u) => u.subscriptionStatus === "subscribed").length}`
  );
  console.log(`   Needs migration: ${usersNeedingStatus.length}`);

  if (usersNeedingStatus.length > 0) {
    console.log(`\n   Users to set as free by default:`);
    usersNeedingStatus.forEach((u) => {
      console.log(`   - ${u.email} (ID: ${u.id})`);
    });

    if (!dryRun) {
      for (const user of usersNeedingStatus) {
        await db
          .update(users)
          .set({ subscriptionStatus: "free" })
          .where(eq(users.id, user.id));
      }
      console.log(
        `   ✓ Updated ${usersNeedingStatus.length} user(s) to free tier`
      );
    }
  }

  // Optionally upgrade a specific user
  if (upgradeUserEmail) {
    console.log(`\n⬆️  Upgrading user to subscribed: ${upgradeUserEmail}`);

    const user = await db.query.users.findFirst({
      where: eq(users.email, upgradeUserEmail),
    });

    if (!user) {
      console.error(`   ❌ User not found: ${upgradeUserEmail}`);
    } else {
      console.log(`   Found: ${user.name || user.email}`);
      console.log(`   Current status: ${user.subscriptionStatus}`);

      if (!dryRun) {
        await db
          .update(users)
          .set({
            subscriptionStatus: "subscribed",
            subscribedAt: new Date(),
          })
          .where(eq(users.id, user.id));
        console.log(`   ✓ Upgraded to subscribed`);
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  if (dryRun) {
    console.log("⚠️  DRY RUN - No changes made");
    console.log("   Run without --dry-run to apply changes");
  } else {
    console.log("✅ Migration complete!");
  }

  // Print current state
  const updatedPapers = await db.select().from(papers);
  const updatedUsers = await db.select().from(users);

  console.log("\n📊 Final State:");
  console.log(
    `   Papers: ${updatedPapers.filter((p) => p.accessTier === "free").length} free, ${updatedPapers.filter((p) => p.accessTier === "premium").length} premium`
  );
  console.log(
    `   Users: ${updatedUsers.filter((u) => u.subscriptionStatus === "free").length} free, ${updatedUsers.filter((u) => u.subscriptionStatus === "subscribed").length} subscribed`
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
