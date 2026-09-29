import { beforeEach, describe, expect, it, vi } from "vitest";

type RpcResult = { data: unknown; error: { message: string } | null };

const rpc = vi.fn<(name: string, args?: unknown) => Promise<RpcResult>>();
const sendEmail = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    rpc,
    auth: {
      getUser: async () => ({
        data: { user: { email: "marta@test.local" } },
      }),
    },
  }),
}));
vi.mock("@clinicalumia/api/email", () => ({ sendEmail }));

const { cancelAppointment } = await import("./actions");

const APPOINTMENT = "77777777-7777-7777-7777-777777777777";

function cancelForm() {
  const data = new FormData();
  data.set("cita", APPOINTMENT);
  return data;
}

const cancelledRow = {
  id: APPOINTMENT,
  person_name: "Marta <b>Ruiz</b>",
  starts_at: "2026-10-02T07:00:00+00:00",
  status: "cancelled",
  service_name: "Sesión de logopedia",
  professional_name: "Ana García",
};

function answer(results: Record<string, RpcResult>) {
  rpc.mockImplementation(
    async (name) => results[name] ?? { data: null, error: null },
  );
}

beforeEach(() => {
  rpc.mockReset();
  sendEmail.mockReset();
});

describe("cancelAppointment", () => {
  it("cancels the appointment, emails the account and goes back to Mi cuenta with the notice", async () => {
    answer({
      cancel_my_appointment: { data: null, error: null },
      my_appointments: { data: [cancelledRow], error: null },
    });

    await expect(cancelAppointment(undefined, cancelForm())).rejects.toThrow(
      "redirect:/mi-cuenta?aviso=cancelada",
    );

    expect(rpc).toHaveBeenCalledWith("cancel_my_appointment", {
      p_appointment_id: APPOINTMENT,
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0]?.[0];
    expect(email.to).toBe("marta@test.local");
    expect(email.subject).toBe("Cita cancelada");
    expect(email.html).toContain("Sesión de logopedia");
    expect(email.html).toContain("Marta &lt;b&gt;Ruiz&lt;/b&gt;");
  });

  it("explains that the window closed and sends nothing, because the appointment is still booked", async () => {
    answer({
      cancel_my_appointment: {
        data: null,
        error: { message: "outside_change_window" },
      },
    });

    expect(await cancelAppointment(undefined, cancelForm())).toEqual({
      error: "Ya no se puede cambiar desde la web. Llama al 614 552 808.",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refuses an appointment of another account without emailing anyone", async () => {
    answer({
      cancel_my_appointment: {
        data: null,
        error: { message: "appointment_not_in_account" },
      },
    });

    expect(await cancelAppointment(undefined, cancelForm())).toEqual({
      error: "Esa cita no está en tu cuenta.",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("still goes back with the notice when the email fails, because the appointment is already cancelled", async () => {
    answer({
      cancel_my_appointment: { data: null, error: null },
      my_appointments: { data: [cancelledRow], error: null },
    });
    sendEmail.mockRejectedValue(new Error("Resend caído"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(cancelAppointment(undefined, cancelForm())).rejects.toThrow(
      "redirect:/mi-cuenta?aviso=cancelada",
    );
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
