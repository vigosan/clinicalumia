import { Resend } from "resend";

const DEFAULT_FROM =
  "Clínica LUMIA <no-responder@notifications.clinicalumia.es>";
const MAILPIT_SEND = "http://127.0.0.1:54324/api/v1/send";

type Email = { to: string; subject: string; html: string };

function parseSender(from: string) {
  const match = /^(.*?)\s*<([^>]+)>$/.exec(from);
  return match
    ? { Name: match[1], Email: match[2] }
    : { Name: "", Email: from };
}

export async function sendEmail({ to, subject, html }: Email): Promise<void> {
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;
  const apiKey = process.env.RESEND_API_KEY;

  if (apiKey) {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject,
      html,
    });
    if (error) {
      throw new Error(
        `No se ha podido enviar el email por Resend: ${error.message}`,
      );
    }
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta RESEND_API_KEY para enviar emails en producción.");
  }

  const response = await fetch(MAILPIT_SEND, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: parseSender(from),
      To: [{ Email: to }],
      Subject: subject,
      HTML: html,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `No se ha podido enviar el email a Mailpit: ${response.status}`,
    );
  }
}
