const nodemailer = require('nodemailer');

// Extract Environment Configuration
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || `SecureVault <${SMTP_USER || 'no-reply@securevault.com'}>`;

// Create Transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE, // true for 465, false for 587 (TLS)
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false // Avoid self-signed certificate failures
  }
});

// Verify Transporter Connection on startup if credentials exist
if (SMTP_USER && SMTP_PASS) {
  transporter.verify((error, success) => {
    if (error) {
      console.warn('⚠️ SMTP Email Transport Verification Warning:', error.message);
    } else {
      console.log(`✉️ SMTP Email Transporter Verified Ready! (${SMTP_HOST}:${SMTP_PORT})`);
    }
  });
}

/**
 * Sends a 6-digit OTP verification email for Password Reset
 * Includes HTML template and plain text fallback to bypass spam filters.
 */
async function sendOtpEmail(toEmail, otpCode) {
  const appName = "SecureVault";
  const cleanEmail = toEmail.toLowerCase().trim();

  // Plain Text Fallback for High Deliverability & Spam Filter Compliance
  const textBody = `
${appName} - Password Reset Verification Code

Your 6-digit security code is: ${otpCode}

This verification code is valid for 5 minutes. If you did not request this password reset, please ignore this email.

Account: ${cleanEmail}
Security Team, ${appName}
`.trim();

  // Clean, Modern, Spam-Free HTML Template
  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} Password Reset Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0F19; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #E2E8F0;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #0B0F19; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #111827; border: 1px solid #1F2937; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 36px 30px 20px 30px; background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #06B6D4; width: 44px; height: 44px; border-radius: 12px; text-align: center; vertical-align: middle;">
                    <span style="font-size: 24px; color: #FFFFFF; font-weight: bold;">🔐</span>
                  </td>
                  <td style="padding-left: 12px;">
                    <span style="font-size: 22px; font-weight: 700; color: #FFFFFF; tracking-tight: -0.5px;">${appName}</span>
                  </td>
                </tr>
              </table>
              <p style="margin: 10px 0 0 0; font-size: 13px; color: #94A3B8;">Zero-Knowledge Encrypted Security System</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #F8FAFC;">Password Reset Security Code</h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
                We received a request to reset your password for <strong style="color: #CBD5E1;">${cleanEmail}</strong>. Enter the following 6-digit OTP code to continue:
              </p>

              <!-- OTP Box -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="padding: 20px; background-color: #0F172A; border: 1px solid #06B6D4; border-radius: 14px;">
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #38BDF8; display: inline-block;">${otpCode}</span>
                  </td>
                </tr>
              </table>

              <!-- Expiry & Warning -->
              <div style="background-color: rgba(239, 68, 68, 0.08); border-left: 3px solid #EF4444; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 13px; color: #FCA5A5; line-height: 1.5;">
                  ⏱️ <strong>This code is valid for 5 minutes.</strong><br>
                  If you did not request a password reset, your account is safe and you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #0B0F19; border-top: 1px solid #1F2937; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748B;">
                © 2026 ${appName}. Automated zero-knowledge security message.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const mailOptions = {
    from: EMAIL_FROM,
    to: cleanEmail,
    subject: `${appName} Security — Your Password Reset Code is ${otpCode}`,
    text: textBody,
    html: htmlBody,
    headers: {
      'X-Priority': '1',
      'X-MSMail-Priority': 'High',
      'Importance': 'High',
      'X-Entity-Ref-ID': `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    }
  };

  // If SMTP user is set, send via live transport
  if (SMTP_USER && SMTP_PASS) {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Live OTP email successfully sent to ${cleanEmail} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } else {
    // Development fallback mode if SMTP credentials aren't live yet
    console.log(`⚠️ SMTP credentials not set. DEV FALLBACK OTP for ${cleanEmail}: [ ${otpCode} ]`);
    return { success: true, devMode: true, devOtp: otpCode };
  }
}

module.exports = {
  sendOtpEmail,
  transporter
};
