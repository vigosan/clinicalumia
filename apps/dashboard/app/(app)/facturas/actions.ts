"use server";

import { sendEmail } from "@clinicalumia/api/email";
import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { loadInvoicePdf } from "@/lib/invoice-pdf";
import { normalizeEmail, type RecipientDraft } from "@/lib/invoices";
import { paymentError } from "@/lib/payments";

export async function issueFullInvoice(
  invoiceId: string,
  recipient: RecipientDraft,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_full_invoice", {
    p_invoice_id: invoiceId,
    p_recipient: {
      name: recipient.name.trim(),
      tax_id: recipient.taxId.trim(),
      address: recipient.address.trim(),
      postal_code: recipient.postalCode.trim(),
      city: recipient.city.trim(),
    },
  });
  if (error) return { error: paymentError(error) };

  revalidatePath("/");
  return { ok: true };
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
  if (error) return { error: paymentError(error) };

  revalidatePath("/");
  return { ok: true };
}

export async function sendInvoiceEmail(
  invoiceId: string,
  input: string,
): Promise<{ ok: true; email: string } | { error: string }> {
  const email = normalizeEmail(input);
  if (!email) return { error: "Escribe un email válido." };

  const supabase = await createClient();
  const invoice = await loadInvoicePdf(supabase, invoiceId);
  if ("error" in invoice) return { error: paymentError(invoice.error) };

  try {
    await sendEmail({
      to: email,
      subject: `Factura ${invoice.code} · Clínica LUMIA`,
      html: `
        <p>Hola:</p>
        <p>Te enviamos adjunta la factura ${invoice.code} de Clínica LUMIA.</p>
        <p>Gracias por tu confianza.</p>
        <p>Clínica LUMIA</p>
      `,
      attachments: [
        {
          filename: invoice.fileName,
          content: invoice.pdf,
          contentType: "application/pdf",
        },
      ],
    });
  } catch {
    return { error: "No se ha podido enviar el email. Inténtalo de nuevo." };
  }

  const { error } = await supabase.rpc("record_invoice_email", {
    p_invoice_id: invoiceId,
    p_email: email,
  });
  if (error) return { error: paymentError(error) };
  return { ok: true, email };
}
