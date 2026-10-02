"use server";

import { createAdminClient } from "@clinicalumia/api/admin";
import { sendEmail } from "@clinicalumia/api/email";
import { headers } from "next/headers";
import { Resend } from "resend";
import {
  attemptsInHour,
  BUSY,
  forgetAttempt,
  hashIp,
  purgeOldAttempts,
  recordAttempt,
} from "@/lib/access-attempts";
import { consentFileName, parseConsent } from "@/lib/consent";
import { consentTitle } from "@/lib/consent-legal";
import { buildConsentPdf } from "@/lib/consent-pdf";
import { storeConsent } from "@/lib/consent-store";
import { site } from "@/lib/site";
import { captchaError } from "@/lib/turnstile";

const MAX_CONSENTS_PER_IP = 15;
const MAX_CONSENTS_PER_HOUR = 30;

export type CollaboratorFormState =
  | { error: string }
  | { ok: true }
  | undefined;

export type ContactFormState = { error: string } | { ok: true } | undefined;

export type ConsentFormState = { error: string } | { ok: true } | undefined;

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

export async function sendContactRequest(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const patientAge = String(formData.get("patientAge") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const privacy = formData.get("privacy");

  if (!name) return { error: "El nombre es obligatorio." };
  if (!phone) return { error: "El teléfono es obligatorio." };
  if (!email) return { error: "El email es obligatorio." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "El email no es válido." };
  }
  if (!privacy) {
    return { error: "Debes aceptar la política de privacidad." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL ?? "info@clinicalumia.es";
  const from =
    process.env.CONTACT_FROM_EMAIL ?? "Lumia <onboarding@resend.dev>";

  if (!apiKey) {
    return { error: "Servicio no configurado. Inténtalo más tarde." };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    replyTo: email,
    subject: `Nueva solicitud de valoración — ${name}`,
    text:
      `Nombre: ${name}\n` +
      `Teléfono: ${phone}\n` +
      `Email: ${email}\n` +
      `Motivo de consulta: ${reason || "—"}\n` +
      `Edad del paciente: ${patientAge || "—"}\n\n` +
      `Mensaje:\n${message || "—"}`,
    html: `
      <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
      <p><strong>Teléfono:</strong> ${escapeHtml(phone)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Motivo de consulta:</strong> ${escapeHtml(reason) || "—"}</p>
      <p><strong>Edad del paciente:</strong> ${escapeHtml(patientAge) || "—"}</p>
      <p><strong>Mensaje:</strong></p>
      <p style="white-space: pre-wrap">${escapeHtml(message) || "—"}</p>
    `,
  });

  if (error) {
    return { error: "No se ha podido enviar el mensaje. Inténtalo de nuevo." };
  }

  return { ok: true };
}

export async function sendConsent(
  _prev: ConsentFormState,
  formData: FormData,
): Promise<ConsentFormState> {
  if (String(formData.get("website") ?? "")) return { ok: true };
  const captcha = await captchaError(formData, "consentimiento");
  if (captcha) return { error: captcha };

  const signedAt = new Date();
  const result = parseConsent(formData, signedAt);
  if ("error" in result) return result;
  const { consent } = result;

  const admin = createAdminClient();
  const ipHash = hashIp(await headers());
  const attempt = await recordAttempt(admin, "consent", null, ipHash);
  await purgeOldAttempts(admin, attempt.created_at);
  const [byIp, total] = await Promise.all([
    attemptsInHour(admin, "consent", attempt.created_at, { ip_hash: ipHash }),
    attemptsInHour(admin, "consent", attempt.created_at, {}),
  ]);
  if (byIp > MAX_CONSENTS_PER_IP || total > MAX_CONSENTS_PER_HOUR) {
    await forgetAttempt(admin, attempt.id);
    return {
      error:
        byIp > MAX_CONSENTS_PER_IP
          ? `Se han enviado muchos consentimientos desde esta conexión. Inténtalo dentro de una hora o llama al ${site.phone.display}.`
          : BUSY,
    };
  }

  let pdf: Uint8Array;
  try {
    pdf = await buildConsentPdf(consent, signedAt);
  } catch {
    return { error: "No se ha podido leer la firma. Vuelve a firmar." };
  }

  try {
    await storeConsent({ admin, consent, signedAt, pdf });
  } catch (error) {
    console.error("No se ha podido guardar el consentimiento", error);
    return {
      error: "No se ha podido guardar el consentimiento. Inténtalo de nuevo.",
    };
  }

  const to = process.env.CONSENT_TO_EMAIL ?? site.email;
  const fullName = `${consent.firstName} ${consent.lastName}`;
  const signer = consent.guardian || fullName;
  const ids = [
    consent.dni && `DNI/NIE ${consent.dni}`,
    consent.guardianDni && `DNI/NIE del tutor/a ${consent.guardianDni}`,
  ]
    .filter(Boolean)
    .join(", ");
  const attachments = [
    {
      filename: consentFileName(consent, signedAt),
      content: pdf,
      contentType: "application/pdf",
    },
  ];

  try {
    await sendEmail({
      to,
      subject: `${consentTitle} — ${fullName}`,
      html: `<p>${escapeHtml(fullName)} (${escapeHtml(ids)}) ha firmado el consentimiento de protección de datos. Se adjunta el documento firmado.</p>`,
      attachments,
    });
  } catch (error) {
    console.error("No se ha podido enviar el consentimiento por email", error);
  }

  if (consent.email) {
    try {
      await sendEmail({
        to: consent.email,
        subject: "Tu consentimiento firmado · Clínica LUMIA",
        html: `<p>Hola, ${escapeHtml(signer)}:</p><p>Te enviamos una copia del ${escapeHtml(consentTitle.toLowerCase())} de ${escapeHtml(fullName)} que has firmado hoy. Guárdala como justificante.</p><p>Si tienes cualquier duda, llámanos al ${escapeHtml(site.phone.display)}.</p><p>Clínica LUMIA</p>`,
        attachments,
      });
    } catch (error) {
      console.error(
        "No se ha podido enviar la copia del consentimiento al firmante",
        error,
      );
    }
  }

  return { ok: true };
}
