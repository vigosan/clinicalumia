"use server";

import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { type RecipientDraft, recipientParams } from "@/lib/invoices";
import { failureFor } from "@/lib/payment-failure";
import { METHOD_ORDER, parseAmount } from "@/lib/payments";

export async function collectPayment(
  appointmentId: string,
  input: {
    amount: string;
    method: string;
    note: string;
    recipient?: RecipientDraft;
  },
): Promise<ActionResult> {
  const parsed = parseAmount(input.amount);
  if ("error" in parsed) return parsed;
  const method = METHOD_ORDER.find((candidate) => candidate === input.method);
  if (!method) return { error: "Elige la forma de pago." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("collect_payment", {
    p_appointment_id: appointmentId,
    p_amount_cents: parsed.cents,
    p_method: method,
    p_note: input.note.trim(),
    ...(input.recipient && { p_recipient: recipientParams(input.recipient) }),
  });
  if (error) {
    if (error.code === "P0001" && error.message === "already_paid")
      revalidatePath("/");
    return failureFor(supabase, error);
  }

  revalidatePath("/");
  return { ok: true };
}

export async function voidPayment(
  paymentId: string,
  reason: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_payment", {
    p_payment_id: paymentId,
    p_reason: reason.trim(),
  });
  if (error) return failureFor(supabase, error);

  revalidatePath("/");
  return { ok: true };
}
