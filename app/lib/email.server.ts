import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@resend.dev";
const APP_NAME = "FCPS Prep";

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }
  return "http://localhost:5173";
}

export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const verifyUrl = `${getBaseUrl()}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  try {
    await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Verify your email for ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2a87ff 0%, #0c50e1 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to ${APP_NAME}!</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="margin-top: 0;">Thanks for signing up! Please verify your email address by clicking the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verifyUrl}" style="background: #2a87ff; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              <p style="color: #64748b; font-size: 14px;">Or copy and paste this link in your browser:</p>
              <p style="background: #e2e8f0; padding: 12px; border-radius: 6px; word-break: break-all; font-size: 12px; color: #475569;">
                ${verifyUrl}
              </p>
              <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">This link will expire in 24 hours. Please verify your email within 7 days to keep access to your account. If you didn't create an account, you can safely ignore this email.</p>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 12px; margin-bottom: 0;">💡 Tip: If you don't see this email in your inbox, please check your spam or junk folder.</p>
            </div>
          </body>
        </html>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`;

  try {
    await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Reset your password for ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2a87ff 0%, #0c50e1 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Reset Your Password</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="margin-top: 0;">We received a request to reset your password. Click the button below to choose a new password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: #2a87ff; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="color: #64748b; font-size: 14px;">Or copy and paste this link in your browser:</p>
              <p style="background: #e2e8f0; padding: 12px; border-radius: 6px; word-break: break-all; font-size: 12px; color: #475569;">
                ${resetUrl}
              </p>
              <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
          </body>
        </html>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

// Generate a secure random token
export function generateToken(): string {
  return crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
}

// Payment/upgrade configuration
const UPGRADE_CONFIG = {
  // Pricing tiers
  yearlyPrice: "PKR 3,000",
  yearlyValidity: "31st July 2026",
  lifetimePrice: "PKR 5,000",
  // Bank details
  bankName: "Habib Bank Limited",
  accountTitle: "Ishaq Ibrahim",
  accountNumber: "05027902121703",
  iban: "", // Leave empty if not needed
  // Contact info
  contactEmail: "ishaqibrahimbss@gmail.com",
  contactWhatsApp: "+92 341 6110684",
  // Admin notification
  adminEmail: "ishaqibrahimbss@gmail.com",
};

export async function sendUpgradeInstructionsEmail(
  email: string,
  userName: string | null
): Promise<{ success: boolean; error?: string }> {
  const greeting = userName ? `Hi ${userName}` : "Hi there";

  try {
    // Send upgrade instructions to the user
    await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Upgrade to Premium - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Upgrade to Premium</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="margin-top: 0; font-size: 16px;">${greeting},</p>
              
              <p>Thank you for your interest in upgrading to Premium! With Premium access, you'll unlock:</p>
              
              <ul style="background: #fef3c7; padding: 20px 20px 20px 40px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <li style="margin-bottom: 8px;"><strong>All question papers</strong> - Access our complete library</li>
                <li style="margin-bottom: 8px;"><strong>Detailed AI explanations</strong> - Understand every answer</li>
                <li style="margin-bottom: 8px;"><strong>Unlimited practice</strong> - No restrictions on attempts</li>
                <li style="margin-bottom: 0;"><strong>Future updates</strong> - Get new papers as they're added</li>
              </ul>
              
              <h2 style="color: #1e293b; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">💰 Pricing Options</h2>
              
              <div style="display: flex; gap: 16px; margin-bottom: 20px;">
                <div style="flex: 1; background: white; padding: 20px; border-radius: 12px; border: 2px solid #e2e8f0; text-align: center;">
                  <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">Until ${UPGRADE_CONFIG.yearlyValidity}</p>
                  <p style="margin: 0; font-size: 28px; font-weight: 700; color: #1e293b;">${UPGRADE_CONFIG.yearlyPrice}</p>
                </div>
              </div>
              
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; border: 2px solid #f59e0b; text-align: center; margin-bottom: 20px;">
                <p style="margin: 0 0 4px 0; color: #92400e; font-size: 12px; font-weight: 600;">⭐ BEST VALUE</p>
                <p style="margin: 0 0 8px 0; color: #78350f; font-size: 14px;">Lifetime Access</p>
                <p style="margin: 0; font-size: 28px; font-weight: 700; color: #78350f;">${UPGRADE_CONFIG.lifetimePrice}</p>
                <p style="margin: 8px 0 0 0; color: #92400e; font-size: 12px;">One-time payment, never pay again!</p>
              </div>
              
              <h2 style="color: #1e293b; margin-top: 25px; margin-bottom: 15px; font-size: 18px;">🏦 Payment Details</h2>
              
              <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; width: 40%;">Bank Name:</td>
                    <td style="padding: 8px 0; font-weight: 600;">${UPGRADE_CONFIG.bankName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Account Title:</td>
                    <td style="padding: 8px 0; font-weight: 600;">${UPGRADE_CONFIG.accountTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Account Number:</td>
                    <td style="padding: 8px 0; font-weight: 600; font-family: monospace;">${UPGRADE_CONFIG.accountNumber}</td>
                  </tr>
                  ${
                    UPGRADE_CONFIG.iban
                      ? `
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">IBAN:</td>
                    <td style="padding: 8px 0; font-weight: 600; font-family: monospace; font-size: 12px;">${UPGRADE_CONFIG.iban}</td>
                  </tr>
                  `
                      : ""
                  }
                </table>
              </div>
              
              <h2 style="color: #1e293b; margin-top: 25px; margin-bottom: 15px; font-size: 18px;">📝 How to Complete Your Upgrade</h2>
              
              <ol style="padding-left: 20px;">
                <li style="margin-bottom: 12px;">Choose your plan and transfer the amount to the account above</li>
                <li style="margin-bottom: 12px;">Take a screenshot of the payment confirmation</li>
                <li style="margin-bottom: 12px;">Send the screenshot along with which plan you chose to:
                  <ul style="margin-top: 8px;">
                    <li>Email: <a href="mailto:${UPGRADE_CONFIG.contactEmail}" style="color: #2a87ff;">${UPGRADE_CONFIG.contactEmail}</a></li>
                    ${UPGRADE_CONFIG.contactWhatsApp ? `<li>WhatsApp: <a href="https://wa.me/${UPGRADE_CONFIG.contactWhatsApp.replace(/[^0-9]/g, "")}" style="color: #2a87ff;">${UPGRADE_CONFIG.contactWhatsApp}</a></li>` : ""}
                  </ul>
                </li>
                <li style="margin-bottom: 0;">Your account will be upgraded within 24 hours!</li>
              </ol>
              
              <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin-top: 25px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px;">
                  <strong>💡 Tip:</strong> Include your email address (${email}) in the payment reference or message so we can identify your payment quickly.
                </p>
              </div>
              
              <p style="color: #64748b; font-size: 14px; margin-top: 25px; margin-bottom: 0;">
                Questions? Reply to this email and we'll be happy to help!
              </p>
            </div>
          </body>
        </html>
      `,
    });

    // Send notification to admin
    await sendUpgradeNotificationToAdmin(email, userName);

    return { success: true };
  } catch (error) {
    console.error("Failed to send upgrade instructions email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

/**
 * Send notification to admin when a question is flagged as inaccurate
 */
export async function sendFlaggedQuestionNotification(
  userEmail: string,
  userName: string | null,
  questionId: number,
  questionText: string,
  paperName: string,
  reason?: string
): Promise<void> {
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Karachi",
    dateStyle: "full",
    timeStyle: "short",
  });

  try {
    await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: UPGRADE_CONFIG.adminEmail,
      subject: `🚩 Question Flagged - ${paperName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🚩 Question Flagged</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="margin-top: 0; font-size: 16px;">A user has flagged a question as potentially inaccurate.</p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; color: #64748b; width: 30%; vertical-align: top;">Paper:</td>
                    <td style="padding: 10px 0; font-weight: 600;">${paperName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #64748b; vertical-align: top;">Question ID:</td>
                    <td style="padding: 10px 0; font-weight: 600;">#${questionId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #64748b; vertical-align: top;">Question:</td>
                    <td style="padding: 10px 0;">${questionText.length > 200 ? questionText.substring(0, 200) + "..." : questionText}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #64748b; vertical-align: top;">Flagged by:</td>
                    <td style="padding: 10px 0; font-weight: 600;">
                      ${userName || "Unknown"} (<a href="mailto:${userEmail}" style="color: #2a87ff;">${userEmail}</a>)
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #64748b; vertical-align: top;">Flagged at:</td>
                    <td style="padding: 10px 0;">${timestamp}</td>
                  </tr>
                </table>
              </div>
              
              ${
                reason
                  ? `
              <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
                <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e;">User's reason:</p>
                <p style="margin: 0; color: #78350f;">${reason}</p>
              </div>
              `
                  : `
              <p style="color: #64748b; font-style: italic;">No reason provided by the user.</p>
              `
              }
              
              <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
                Please review this question and make corrections if needed.
              </p>
            </div>
          </body>
        </html>
      `,
    });
  } catch (error) {
    // Don't fail the main request if notification fails
    console.error("Failed to send flagged question notification:", error);
  }
}

/**
 * Send notification to admin when a user requests upgrade instructions
 */
async function sendUpgradeNotificationToAdmin(
  userEmail: string,
  userName: string | null
): Promise<void> {
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Karachi",
    dateStyle: "full",
    timeStyle: "short",
  });

  try {
    await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: UPGRADE_CONFIG.adminEmail,
      subject: `🔔 New Upgrade Request - ${userName || userEmail}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🔔 New Upgrade Request!</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="margin-top: 0; font-size: 16px;">A user has requested upgrade instructions. Here are their details:</p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; color: #64748b; width: 30%;">Name:</td>
                    <td style="padding: 10px 0; font-weight: 600;">${userName || "Not provided"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #64748b;">Email:</td>
                    <td style="padding: 10px 0; font-weight: 600;">
                      <a href="mailto:${userEmail}" style="color: #2a87ff;">${userEmail}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #64748b;">Requested at:</td>
                    <td style="padding: 10px 0; font-weight: 600;">${timestamp}</td>
                  </tr>
                </table>
              </div>
              
              <p style="color: #64748b; font-size: 14px;">
                The user has been sent payment instructions. Follow up with them if you don't receive payment within a few days.
              </p>
              
              <div style="margin-top: 20px;">
                <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">Quick actions:</p>
                <a href="mailto:${userEmail}?subject=Following up on your FCPS Prep upgrade" style="display: inline-block; background: #2a87ff; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-right: 10px;">
                  Email User
                </a>
                <a href="https://wa.me/${userEmail.includes("@") ? "" : userEmail.replace(/[^0-9]/g, "")}" style="display: inline-block; background: #25d366; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                  WhatsApp
                </a>
              </div>
            </div>
          </body>
        </html>
      `,
    });
  } catch (error) {
    // Don't fail the main request if admin notification fails
    console.error("Failed to send admin notification:", error);
  }
}
