import { Resend } from "resend";

export function emailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  if (!emailEnabled()) {
    console.warn("sendEmail: RESEND_API_KEY or EMAIL_FROM missing — skipping");
    return { skipped: true as const };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  if (error) {
    console.error("sendEmail failed", error);
    return { error: error.message };
  }
  return { ok: true as const };
}
