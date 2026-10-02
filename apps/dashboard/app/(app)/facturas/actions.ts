"use server";

import { sendEmail } from "@clinicalumia/api/email";
import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { isMinor } from "@clinicalumia/api/person";
import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { loadInvoicePdf } from "@/lib/invoice-pdf";
import {
  invoiceEmailHtml,
  normalizeEmail,
  type RecipientDraft,
  recipientParams,
} from "@/lib/invoices";
import { failureFor } from "@/lib/payment-failure";
import { type PaymentFailure, paymentError } from "@/lib/payments";

export async function issueFullInvoice(
  invoiceId: string,
  recipient: RecipientDraft,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_full_invoice", {
    p_invoice_id: invoiceId,
    p_recipient: recipientParams(recipient),
  });
  if (error) return failureFor(supabase, error);

  revalidatePath("/");
  revalidatePath("/facturas");
  revalidatePath(`/facturas/${invoiceId}`);
  return { ok: true };
}

export async function correctInvoiceRecipient(
  invoiceId: string,
  recipient: RecipientDraft,
): Promise<{ ok: true; id: string } | PaymentFailure> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("correct_full_invoice_recipient", {
    p_invoice_id: invoiceId,
    p_recipient: recipientParams(recipient),
  });
  if (error) return failureFor(supabase, error);

  revalidatePath("/");
  revalidatePath("/facturas");
  revalidatePath(`/facturas/${invoiceId}`);
  return { ok: true, id: data };
}

export async function issueRectifyingInvoice(
  invoiceId: string,
  reason: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_rectifying_invoice", {
    p_invoice_id: invoiceId,
    p_reason: reason.trim(),
  });
  if (error) return failureFor(supabase, error);

  revalidatePath("/");
  revalidatePath("/facturas");
  revalidatePath(`/facturas/${invoiceId}`);
  return { ok: true };
}

export async function sendInvoiceEmail(
  invoiceId: string,
  input: string,
  saveToRecord = false,
): Promise<{ ok: true; email: string } | { error: string }> {
  const email = normalizeEmail(input);
  if (!email) return { error: "Escribe un email válido." };

  const supabase = await createClient();
  const invoice = await loadInvoicePdf(supabase, invoiceId).catch((error) => {
    console.error("No se ha podido generar el PDF de la factura", error);
    return null;
  });
  if (!invoice)
    return {
      error:
        "No se ha podido generar el PDF de la factura. Inténtalo de nuevo.",
    };
  if ("error" in invoice) return { error: paymentError(invoice.error) };

  try {
    await sendEmail({
      to: email,
      subject: `Factura ${invoice.code} · Clínica LUMIA`,
      html: invoiceEmailHtml(invoice.code),
      attachments: [
        {
          filename: invoice.fileName,
          content: invoice.pdf,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (error) {
    console.error("No se ha podido enviar la factura por email", error);
    return { error: "No se ha podido enviar el email. Inténtalo de nuevo." };
  }

  const { error } = await supabase.rpc("record_invoice_email", {
    p_invoice_id: invoiceId,
    p_email: email,
  });
  if (error)
    console.error("No se ha podido registrar el envío de la factura", error);

  if (saveToRecord) {
    const { data: patient } = await supabase
      .from("people")
      .select("birth_date")
      .eq("id", invoice.patientId)
      .maybeSingle();
    const minor = patient?.birth_date
      ? isMinor(patient.birth_date, todayInMadrid())
      : false;
    if (patient && !minor) {
      const { error: saveError } = await supabase
        .from("people")
        .update({ email })
        .eq("id", invoice.patientId)
        .is("email", null);
      if (saveError)
        console.error(
          "No se ha podido guardar el email en la ficha",
          saveError,
        );
      revalidatePath("/");
      revalidatePath(`/patients/${invoice.patientId}`);
    }
  }
  return { ok: true, email };
}
