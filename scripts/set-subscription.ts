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
    "Subscription status (free or subscribed)"
  )
  .parse();

const options = program.opts();

async function main() {
  const email = options.email as string;
  const status = options.status as "free" | "subscribed";

  // Validate status
  if (!["free", "subscribed"].includes(status)) {
    console.error(
      `\n❌ Invalid status: ${status}. Must be 'free' or 'subscribed'.`
    );
    process.exit(1);
  }

  console.log("\n👤 Set User Subscription");
  console.log("=".repeat(50));
  console.log(`Email: ${email}`);
  console.log(`Status: ${status}`);
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

  // Update subscription status
  const updateData: {
    subscriptionStatus: "free" | "subscribed";
    subscribedAt?: Date | null;
  } = {
    subscriptionStatus: status,
  };

  // Set subscribedAt timestamp when upgrading to subscribed
  if (status === "subscribed" && user.subscriptionStatus !== "subscribed") {
    updateData.subscribedAt = new Date();
    console.log(`   Setting subscribedAt to now`);
  } else if (status === "free") {
    updateData.subscribedAt = null;
    console.log(`   Clearing subscribedAt`);
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
    console.log(
      `   Subscribed At: ${
        updatedUser.subscribedAt
          ? updatedUser.subscribedAt.toISOString()
          : "(not subscribed)"
      }`
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
