"use server";

import { Resend } from "resend";

export type CollaboratorFormState =
  | { error: string }
  | { ok: true }
  | undefined;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendCollaboratorRequest(
  _prev: CollaboratorFormState,
  formData: FormData,
): Promise<CollaboratorFormState> {
  const specialty = String(formData.get("specialty") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!specialty) return { error: "La especialidad es obligatoria." };
  if (!email) return { error: "El email es obligatorio." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "El email no es válido." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.COLLABORATOR_TO_EMAIL ?? "info@clinicalumia.es";
  const from =
    process.env.COLLABORATOR_FROM_EMAIL ?? "Lumia <onboarding@resend.dev>";

  if (!apiKey) {
    return { error: "Servicio no configurado. Inténtalo más tarde." };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    replyTo: email,
    subject: `Nuevo colaborador/a — ${specialty}`,
    text:
      `Especialidad: ${specialty}\n` +
      `Teléfono: ${phone || "—"}\n` +
      `Email: ${email}\n\n` +
      `Mensaje:\n${message || "—"}`,
    html: `
      <p><strong>Especialidad:</strong> ${escapeHtml(specialty)}</p>
      <p><strong>Teléfono:</strong> ${escapeHtml(phone) || "—"}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Mensaje:</strong></p>
      <p style="white-space: pre-wrap">${escapeHtml(message) || "—"}</p>
    `,
  });

  if (error) {
    return { error: "No se ha podido enviar el mensaje. Inténtalo de nuevo." };
  }

  return { ok: true };
}
