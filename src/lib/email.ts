// Email utility — uses Resend when RESEND_API_KEY is set, otherwise logs to console.

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "LMS <noreply@yourdomain.com>";

  if (!apiKey) {
    console.log(`[email] No RESEND_API_KEY — would have sent email:
  To: ${payload.to}
  Subject: ${payload.subject}
`);
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({ from, to: payload.to, subject: payload.subject, html: payload.html });
  } catch (err) {
    console.error("[email] Failed to send:", err);
  }
}

// ─── Templates ─────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Welcome to the LMS platform",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0c0e14;color:#e2e8f0;border-radius:10px;">
        <h1 style="font-size:22px;font-weight:600;color:#f0f4ff;margin-bottom:8px;">Welcome, ${name || to}!</h1>
        <p style="color:#7a90bc;line-height:1.6;margin-bottom:24px;">
          Your learner account has been created. Sign in to access your enrolled courses and start learning.
        </p>
        <a href="${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/auth"
           style="display:inline-block;background:#5a7aff;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:500;">
          Sign In
        </a>
        <p style="margin-top:24px;font-size:12px;color:#3a4a68;">
          If you did not expect this email, you can ignore it.
        </p>
      </div>
    `,
  });
}

export async function sendEnrollmentEmail(to: string, name: string, courseTitle: string): Promise<void> {
  await sendEmail({
    to,
    subject: `You've been enrolled in "${courseTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0c0e14;color:#e2e8f0;border-radius:10px;">
        <h1 style="font-size:22px;font-weight:600;color:#f0f4ff;margin-bottom:8px;">New Course Enrollment</h1>
        <p style="color:#7a90bc;line-height:1.6;margin-bottom:8px;">Hi ${name || to},</p>
        <p style="color:#7a90bc;line-height:1.6;margin-bottom:24px;">
          You've been enrolled in <strong style="color:#c5d0e8;">${courseTitle}</strong>. Head to your dashboard to start the course.
        </p>
        <a href="${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/dashboard"
           style="display:inline-block;background:#5a7aff;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:500;">
          Go to My Dashboard
        </a>
      </div>
    `,
  });
}

export async function sendCompletionEmail(
  learnerEmail: string,
  learnerName: string,
  courseTitle: string,
  score: number | null,
  enrollmentId: string,
): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const certUrl = `${baseUrl}/certificate/${enrollmentId}`;

  await sendEmail({
    to: learnerEmail,
    subject: `Congratulations! You completed "${courseTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0c0e14;color:#e2e8f0;border-radius:10px;">
        <h1 style="font-size:22px;font-weight:600;color:#f0f4ff;margin-bottom:8px;">Course Completed!</h1>
        <p style="color:#7a90bc;line-height:1.6;margin-bottom:8px;">Well done, ${learnerName || learnerEmail}!</p>
        <p style="color:#7a90bc;line-height:1.6;margin-bottom:8px;">
          You've successfully completed <strong style="color:#c5d0e8;">${courseTitle}</strong>.
        </p>
        ${score != null ? `<p style="color:#4ade80;font-size:20px;font-weight:600;margin-bottom:24px;">Score: ${Math.round(score)}%</p>` : ""}
        <a href="${certUrl}"
           style="display:inline-block;background:#4ade80;color:#0a0b0f;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
          View Certificate
        </a>
      </div>
    `,
  });

  // Also notify the admin if configured
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `${learnerName || learnerEmail} completed "${courseTitle}"`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0c0e14;color:#e2e8f0;border-radius:10px;">
          <p style="color:#7a90bc;line-height:1.6;">
            <strong style="color:#c5d0e8;">${learnerName || learnerEmail}</strong> (${learnerEmail}) completed
            <strong style="color:#c5d0e8;">${courseTitle}</strong>${score != null ? ` with a score of ${Math.round(score)}%` : ""}.
          </p>
          <a href="${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/admin/analytics"
             style="display:inline-block;margin-top:16px;background:#5a7aff;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:500;">
            View Analytics
          </a>
        </div>
      `,
    });
  }
}
