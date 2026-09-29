import { beforeEach, describe, expect, it, vi } from "vitest";

type RpcResult = { data: unknown; error: { message: string } | null };

const rpc = vi.fn<(name: string, args?: unknown) => Promise<RpcResult>>();

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

const { confirmBooking, savePerson } = await import("./actions");
const { PRIVACY_VERSION } = await import("@/lib/booking");

const SERVICE = "22222222-2222-2222-2222-222222222222";
const PERSON = "55555555-5555-5555-5555-555555555555";
const APPOINTMENT = "77777777-7777-7777-7777-777777777777";
const GUARDIAN = "88888888-8888-8888-8888-888888888888";
const MINOR = "99999999-9999-9999-9999-999999999999";
const STARTS_AT = "2026-10-02T07:00:00.000Z";

const chosen = new URLSearchParams({
  servicio: SERVICE,
  profesional: "cualquiera",
  fecha: "2026-09-29",
  inicio: STARTS_AT,
});

function confirmForm() {
  const data = new FormData();
  data.set("estado", `${chosen.toString()}&persona=${PERSON}`);
  return data;
}

function appointmentRow(overrides: Record<string, string> = {}) {
  return {
    id: APPOINTMENT,
    person_id: PERSON,
    person_name: "Marta Ruiz",
    starts_at: "2026-10-02T07:00:00+00:00",
    ends_at: "2026-10-02T07:45:00+00:00",
    status: "scheduled",
    service_name: "Sesión de logopedia",
    professional_name: "Ana García",
    origin: "web",
    ...overrides,
  };
}

function answer(results: Record<string, RpcResult | RpcResult[]>) {
  const calls: Record<string, number> = {};
  rpc.mockImplementation(async (name) => {
    const result = results[name];
    if (!Array.isArray(result)) return result ?? { data: null, error: null };
    const index = calls[name] ?? 0;
    calls[name] = index + 1;
    return result[index] as RpcResult;
  });
}

beforeEach(() => {
  rpc.mockReset();
});

describe("confirmBooking", () => {
  it("books the slot and shows the confirmation, asking for any free professional when the patient chose 'El primer hueco libre'", async () => {
    answer({
      book_appointment: { data: APPOINTMENT, error: null },
      my_appointments: { data: [appointmentRow()], error: null },
    });

    await expect(confirmBooking(undefined, confirmForm())).rejects.toThrow(
      `redirect:/reservar/confirmada?cita=${APPOINTMENT}`,
    );

    expect(rpc).toHaveBeenCalledWith("book_appointment", {
      p_person_id: PERSON,
      p_service_id: SERVICE,
      p_professional_id: null,
      p_starts_at: STARTS_AT,
    });
  });

  it("sends the patient back to the slots with a warning and without the taken time when someone else got it first", async () => {
    answer({
      book_appointment: {
        data: null,
        error: { message: "slot_not_available" },
      },
      my_appointments: { data: [], error: null },
    });

    const thrown = (await confirmBooking(undefined, confirmForm()).catch(
      (error: Error) => error,
    )) as Error;

    const url = new URL(thrown.message.replace("redirect:", ""), "http://x");
    expect(url.pathname).toBe("/reservar");
    expect(url.searchParams.get("aviso")).toBe("ocupado");
    expect(url.searchParams.get("inicio")).toBeNull();
    expect(url.searchParams.get("servicio")).toBe(SERVICE);
  });

  it("treats a second submit of the same booking as the confirmation, because the first one already booked it", async () => {
    answer({
      book_appointment: {
        data: null,
        error: { message: "slot_not_available" },
      },
      my_appointments: { data: [appointmentRow()], error: null },
    });

    await expect(confirmBooking(undefined, confirmForm())).rejects.toThrow(
      `redirect:/reservar/confirmada?cita=${APPOINTMENT}`,
    );
  });

  it("does not take a cancelled appointment at that time as a previous submit", async () => {
    answer({
      book_appointment: {
        data: null,
        error: { message: "slot_not_available" },
      },
      my_appointments: {
        data: [appointmentRow({ status: "cancelled" })],
        error: null,
      },
    });

    await expect(confirmBooking(undefined, confirmForm())).rejects.toThrow(
      /redirect:\/reservar\?.*aviso=ocupado/,
    );
  });

  it("explains other refusals in plain words", async () => {
    answer({
      book_appointment: {
        data: null,
        error: { message: "service_not_bookable" },
      },
    });

    expect(await confirmBooking(undefined, confirmForm())).toEqual({
      error: "Este servicio se reserva por teléfono.",
    });
  });
});

function personForm(values: Record<string, string>) {
  const data = new FormData();
  data.set("estado", chosen.toString());
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const self = {
  para: "yo",
  first_name: "Marta",
  last_name: "Ruiz",
  birth_date: "1990-04-02",
  phone: "600 111 222",
};

const minor = {
  para: "menor",
  first_name: "Leo",
  last_name: "Ruiz",
  birth_date: "2019-06-10",
  phone: "",
  relationship: "madre",
};

describe("savePerson", () => {
  it("saves the account holder as a patient with the privacy version accepted and moves on to the summary", async () => {
    answer({ add_my_person: { data: PERSON, error: null } });

    await expect(
      savePerson(undefined, personForm({ ...self, privacy: "on" })),
    ).rejects.toThrow(new RegExp(`redirect:/reservar\\?.*persona=${PERSON}`));

    expect(rpc).toHaveBeenCalledWith("add_my_person", {
      p_first_name: "Marta",
      p_last_name: "Ruiz",
      p_birth_date: "1990-04-02",
      p_phone: "600111222",
      p_guardian_id: null,
      p_relationship: null,
      p_is_patient: true,
      p_accept_privacy: true,
      p_privacy_version: PRIVACY_VERSION,
    });
  });

  it("for a new minor, first saves the mother as a non-patient guardian with the privacy accepted, then the minor under her", async () => {
    answer({
      add_my_person: [
        { data: GUARDIAN, error: null },
        { data: MINOR, error: null },
      ],
    });

    await expect(
      savePerson(
        undefined,
        personForm({
          ...minor,
          guardian_first_name: "Marta",
          guardian_last_name: "Ruiz",
          guardian_birth_date: "1990-04-02",
          guardian_phone: "600111222",
          privacy: "on",
        }),
      ),
    ).rejects.toThrow(new RegExp(`redirect:/reservar\\?.*persona=${MINOR}`));

    expect(rpc).toHaveBeenNthCalledWith(1, "add_my_person", {
      p_first_name: "Marta",
      p_last_name: "Ruiz",
      p_birth_date: "1990-04-02",
      p_phone: "600111222",
      p_guardian_id: null,
      p_relationship: null,
      p_is_patient: false,
      p_accept_privacy: true,
      p_privacy_version: PRIVACY_VERSION,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "add_my_person", {
      p_first_name: "Leo",
      p_last_name: "Ruiz",
      p_birth_date: "2019-06-10",
      p_phone: null,
      p_guardian_id: GUARDIAN,
      p_relationship: "madre",
      p_is_patient: true,
      p_accept_privacy: false,
      p_privacy_version: null,
    });
  });

  it("puts a new minor under an adult already in the account without asking for the adult again", async () => {
    answer({ add_my_person: { data: MINOR, error: null } });

    await expect(
      savePerson(undefined, personForm({ ...minor, guardian_id: GUARDIAN })),
    ).rejects.toThrow(/redirect:/);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "add_my_person",
      expect.objectContaining({
        p_guardian_id: GUARDIAN,
        p_relationship: "madre",
      }),
    );
  });

  it("rejects missing details before saving anybody, so no half-filled person is left in the account", async () => {
    expect(
      await savePerson(
        undefined,
        personForm({ ...minor, relationship: "", guardian_id: GUARDIAN }),
      ),
    ).toEqual({ error: "Indica la relación con el menor." });
    expect(
      await savePerson(
        undefined,
        personForm({ ...minor, guardian_first_name: "", privacy: "on" }),
      ),
    ).toEqual({ error: "El nombre es obligatorio." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("explains a database refusal such as the missing privacy acceptance", async () => {
    answer({
      add_my_person: { data: null, error: { message: "privacy_required" } },
    });

    expect(await savePerson(undefined, personForm(self))).toEqual({
      error: "Tienes que aceptar la política de privacidad.",
    });
  });
});
