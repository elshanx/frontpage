import 'server-only';
import env from '@/lib/env';

export default async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  if (!env.RESEND_API_KEY) {
    console.warn(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
  });
  if (!response.ok) throw new Error(`Resend rejected the email (${response.status})`);
}
