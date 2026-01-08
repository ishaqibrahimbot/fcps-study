#!/usr/bin/env npx tsx

/**
 * Send an email template to all users
 *
 * Usage:
 *   npx tsx scripts/send-email-blast.ts --template <template-file> [--exclude email1,email2]
 *
 * Options:
 *   --template, -t   Path to template JSON file in emails/ folder (required)
 *   --exclude, -e    Comma-separated list of emails to exclude (optional)
 *   --dry-run        Print emails that would be sent without actually sending
 */

import "dotenv/config";
import { Command } from "commander";
import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";
import { db } from "../app/db";
import { users } from "../app/db/schema";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@resend.dev";
const APP_NAME = "FCPS Study";

interface EmailTemplate {
  id: string;
  subject: string;
  html: string;
}

const program = new Command();

const ADMIN_EMAIL = "ishaqibrahimbss@gmail.com";

program
  .name("send-email-blast")
  .description("Send an email template to all users")
  .requiredOption(
    "-t, --template <file>",
    "Template file name in emails/ folder"
  )
  .option("-e, --exclude <emails>", "Comma-separated list of emails to exclude")
  .option("--dry-run", "Print what would be sent without actually sending")
  .option("--test", "Send only to admin email for testing")
  .parse();

const options = program.opts();

async function main() {
  const templateFile = options.template as string;
  const excludeEmails = options.exclude
    ? (options.exclude as string).split(",").map((e) => e.trim().toLowerCase())
    : [];
  const dryRun = options.dryRun as boolean;
  const testMode = options.test as boolean;

  // Load template
  const templatePath = path.resolve(
    process.cwd(),
    "emails",
    templateFile.endsWith(".json") ? templateFile : `${templateFile}.json`
  );

  if (!fs.existsSync(templatePath)) {
    console.error(`\n❌ Template not found: ${templatePath}`);
    console.log("\nAvailable templates:");
    const emailsDir = path.resolve(process.cwd(), "emails");
    if (fs.existsSync(emailsDir)) {
      const files = fs
        .readdirSync(emailsDir)
        .filter((f) => f.endsWith(".json"));
      files.forEach((f) => console.log(`  - ${f}`));
    }
    process.exit(1);
  }

  const template: EmailTemplate = JSON.parse(
    fs.readFileSync(templatePath, "utf-8")
  );

  console.log("\n📧 Email Blast");
  console.log("=".repeat(60));
  console.log(`Template: ${template.id}`);
  console.log(`Subject: ${template.subject}`);
  if (testMode) {
    console.log(`🧪 TEST MODE - Sending only to admin: ${ADMIN_EMAIL}`);
  }
  if (excludeEmails.length > 0 && !testMode) {
    console.log(`Excluding: ${excludeEmails.join(", ")}`);
  }
  if (dryRun) {
    console.log("🔶 DRY RUN - No emails will be sent");
  }
  console.log("=".repeat(60));

  // Check for API key
  if (!process.env.RESEND_API_KEY && !dryRun) {
    console.error("\n❌ RESEND_API_KEY environment variable is not set");
    process.exit(1);
  }

  let recipients: { email: string; name: string | null }[];

  if (testMode) {
    // Test mode: only send to admin
    recipients = [{ email: ADMIN_EMAIL, name: "Admin (Test)" }];
    console.log(`\n🧪 Test mode: sending to ${ADMIN_EMAIL} only`);
  } else {
    // Fetch all users
    const allUsers = await db.query.users.findMany();
    console.log(`\n📋 Found ${allUsers.length} total users`);

    // Filter out excluded emails
    recipients = allUsers.filter(
      (u) => !excludeEmails.includes(u.email.toLowerCase())
    );
    console.log(`📤 Sending to ${recipients.length} users`);
  }

  if (recipients.length === 0) {
    console.log("\n⚠️ No recipients to send to!");
    process.exit(0);
  }

  // Confirm before sending
  if (!dryRun) {
    console.log("\n⚠️ This will send emails to real users!");
    console.log("Press Ctrl+C within 5 seconds to cancel...\n");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  let sent = 0;
  let failed = 0;

  for (const user of recipients) {
    const greeting = user.name ? `Hi ${user.name}` : "Hi there";
    const personalizedHtml = template.html.replace(
      /Assalam o Alaikum! 👋/g,
      `${greeting}! 👋`
    );

    if (dryRun) {
      console.log(
        `  📧 Would send to: ${user.email} (${user.name || "no name"})`
      );
      sent++;
    } else {
      try {
        await resend.emails.send({
          from: `${APP_NAME} <${FROM_EMAIL}>`,
          to: user.email,
          subject: template.subject,
          html: personalizedHtml,
        });
        console.log(`  ✅ Sent to: ${user.email}`);
        sent++;

        // Rate limiting - small delay between emails
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`  ❌ Failed: ${user.email} - ${error}`);
        failed++;
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log(`   ${dryRun ? "Would send" : "Sent"}: ${sent}`);
  if (failed > 0) {
    console.log(`   Failed: ${failed}`);
  }
  console.log("=".repeat(60));

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
