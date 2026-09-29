import { Resend } from "resend";

const DEFAULT_FROM =
  "Clínica LUMIA <no-responder@notifications.clinicalumia.es>";
const MAILPIT_SEND = "http://127.0.0.1:54324/api/v1/send";

type Attachment = { filename: string; content: string; contentType: string };
type Email = {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Attachment[];
};

function parseSender(from: string) {
  const match = /^(.*?)\s*<([^>]+)>$/.exec(from);
  return match
    ? { Name: match[1], Email: match[2] }
    : { Name: "", Email: from };
}

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: Email): Promise<void> {
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;
  const apiKey = process.env.RESEND_API_KEY;

  if (process.env.NODE_ENV === "production") {
    if (!apiKey) {
      throw new Error("Falta RESEND_API_KEY para enviar emails en producción.");
    }
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject,
      html,
      ...(attachments && {
        attachments: attachments.map(({ filename, content, contentType }) => ({
          filename,
          content: Buffer.from(content).toString("base64"),
          contentType,
        })),
      }),
    });
    if (error) {
      throw new Error(
        `No se ha podido enviar el email por Resend: ${error.message}`,
      );
    }
    return;
  }

  const response = await fetch(MAILPIT_SEND, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: parseSender(from),
      To: [to].flat().map((email) => ({ Email: email })),
      Subject: subject,
      HTML: html,
      ...(attachments && {
        Attachments: attachments.map(({ filename, content, contentType }) => ({
          Filename: filename,
          Content: Buffer.from(content).toString("base64"),
          ContentType: contentType,
        })),
      }),
    }),
  });
  if (!response.ok) {
    throw new Error(
      `No se ha podido enviar el email a Mailpit: ${response.status}`,
    );
  }
}
