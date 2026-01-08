#!/usr/bin/env npx tsx

import "dotenv/config";
import { Command } from "commander";
import { eq } from "drizzle-orm";
import { db } from "../app/db";
import { users } from "../app/db/schema";

const program = new Command();

program
  .name("set-subscription")
  .description("Set subscription status for a user")
  .requiredOption("-e, --email <email>", "User email address")
  .requiredOption(
    "-s, --status <status>",
    "Subscription status (free or lifetime)"
  )
  .option("-c, --credits <credits>", "Credits to add (optional)", parseInt)
  .parse();

const options = program.opts();

async function main() {
  const email = options.email as string;
  const status = options.status as "free" | "lifetime";
  const creditsToAdd = options.credits as number | undefined;

  // Validate status
  if (!["free", "lifetime"].includes(status)) {
    console.error(
      `\n❌ Invalid status: ${status}. Must be 'free' or 'lifetime'.`
    );
    process.exit(1);
  }

  console.log("\n👤 Set User Subscription");
  console.log("=".repeat(50));
  console.log(`Email: ${email}`);
  console.log(`Status: ${status}`);
  if (creditsToAdd !== undefined) {
    console.log(`Credits to add: ${creditsToAdd}`);
  }
  console.log("=".repeat(50));

  // Check for database connection
  if (!process.env.DATABASE_URL) {
    console.error("\n❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  // Find the user
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    console.error(`\n❌ User not found with email: ${email}`);
    process.exit(1);
  }

  console.log(`\n👤 Found user: ${user.name || user.email}`);
  console.log(`   Current status: ${user.subscriptionStatus}`);
  console.log(`   Current credits: ${user.credits}`);

  // Update subscription status
  const updateData: {
    subscriptionStatus: "free" | "lifetime";
    subscribedAt?: Date | null;
    credits?: number;
  } = {
    subscriptionStatus: status,
  };

  // Set subscribedAt timestamp when upgrading to lifetime
  if (status === "lifetime" && user.subscriptionStatus !== "lifetime") {
    updateData.subscribedAt = new Date();
    console.log(`   Setting subscribedAt to now`);
  } else if (status === "free") {
    updateData.subscribedAt = null;
    console.log(`   Clearing subscribedAt`);
  }

  // Add credits if specified
  if (creditsToAdd !== undefined) {
    updateData.credits = user.credits + creditsToAdd;
    console.log(`   Setting credits to ${updateData.credits}`);
  }

  await db.update(users).set(updateData).where(eq(users.id, user.id));

  console.log(`\n✅ Subscription status updated to: ${status}`);

  // Show updated user info
  const updatedUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (updatedUser) {
    console.log(`\n📋 Updated User Info:`);
    console.log(`   Name: ${updatedUser.name || "(no name)"}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Status: ${updatedUser.subscriptionStatus}`);
    console.log(`   Credits: ${updatedUser.credits}`);
    console.log(
      `   Subscribed At: ${
        updatedUser.subscribedAt
          ? updatedUser.subscribedAt.toISOString()
          : "(not lifetime)"
      }`
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
