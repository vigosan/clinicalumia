import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcResult: {
  data: unknown;
  error: { code?: string; message?: string } | null;
} = { data: null, error: null };
const rpc = vi.fn(async () => rpcResult);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({ rpc }),
}));

const { collectPayment, voidPayment } = await import("./actions");

beforeEach(() => {
  rpc.mockClear();
  vi.mocked(revalidatePath).mockClear();
  rpcResult.data = null;
  rpcResult.error = null;
});

describe("collectPayment", () => {
  it("sends the typed amount in cents and a trimmed note, then refreshes the agenda so the panel shows the new status", async () => {
    rpcResult.data = "payment-1";
    const result = await collectPayment("appt-1", {
      amount: "45,5",
      method: "bizum",
      note: "  Descuento de familia  ",
    });
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("collect_payment", {
      p_appointment_id: "appt-1",
      p_amount_cents: 4550,
      p_method: "bizum",
      p_note: "Descuento de familia",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("rejects an unreadable amount before reaching the database, so a typo never becomes a charge", async () => {
    const result = await collectPayment("appt-1", {
      amount: "abc",
      method: "cash",
      note: "",
    });
    expect(result).toEqual({ error: "Escribe un importe válido." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a method outside the four the clinic accepts", async () => {
    const result = await collectPayment("appt-1", {
      amount: "45",
      method: "cheque",
      note: "",
    });
    expect(result).toEqual({ error: "Elige la forma de pago." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("tells the slower of two people collecting at once that the appointment is already paid, and leaves the agenda untouched", async () => {
    rpcResult.error = { code: "P0001", message: "already_paid" };
    const result = await collectPayment("appt-1", {
      amount: "55",
      method: "cash",
      note: "",
    });
    expect(result).toEqual({ error: "Esta cita ya está cobrada." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("voidPayment", () => {
  it("sends the trimmed reason and refreshes the agenda", async () => {
    const result = await voidPayment("payment-1", "  Cobrado por error  ");
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("void_payment", {
      p_payment_id: "payment-1",
      p_reason: "Cobrado por error",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("explains who may void when the database refuses a colleague's payment", async () => {
    rpcResult.error = { code: "P0001", message: "not_allowed" };
    const result = await voidPayment("payment-1", "Error");
    expect(result).toEqual({
      error:
        "Solo puede anular este cobro quien lo registró hoy o la propietaria.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
