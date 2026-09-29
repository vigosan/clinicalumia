import { beforeEach, describe, expect, it, vi } from "vitest";

type RpcResult = { data: unknown; error: { message: string } | null };

const rpc = vi.fn<(name: string, args?: unknown) => Promise<RpcResult>>();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({ rpc }),
}));

const { addMinor, updateContact } = await import("./actions");
const { PRIVACY_VERSION } = await import("@/lib/booking");

const ADULT = "88888888-8888-8888-8888-888888888888";
const MINOR = "99999999-9999-9999-9999-999999999999";

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

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const minor = {
  first_name: "Leo",
  last_name: "Ruiz",
  birth_date: "2019-06-10",
  phone: "",
  relationship: "madre",
};

const newGuardian = {
  guardian_first_name: "Marta",
  guardian_last_name: "Ruiz",
  guardian_birth_date: "1990-04-02",
  guardian_phone: "600 111 222",
};

describe("addMinor", () => {
  it("puts the minor under the adult chosen as guardian and goes back to Mi cuenta with the notice", async () => {
    answer({ add_my_person: { data: MINOR, error: null } });

    await expect(
      addMinor(undefined, form({ ...minor, guardian_id: ADULT })),
    ).rejects.toThrow("redirect:/mi-cuenta?aviso=menor");

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("add_my_person", {
      p_first_name: "Leo",
      p_last_name: "Ruiz",
      p_birth_date: "2019-06-10",
      p_phone: null,
      p_guardian_id: ADULT,
      p_relationship: "madre",
      p_is_patient: true,
      p_accept_privacy: false,
      p_privacy_version: null,
    });
  });

  it("records the privacy acceptance with the minor when the account had not accepted it yet", async () => {
    answer({ add_my_person: { data: MINOR, error: null } });

    await expect(
      addMinor(
        undefined,
        form({ ...minor, guardian_id: ADULT, privacy: "on" }),
      ),
    ).rejects.toThrow("redirect:/mi-cuenta?aviso=menor");

    expect(rpc).toHaveBeenCalledWith(
      "add_my_person",
      expect.objectContaining({
        p_accept_privacy: true,
        p_privacy_version: PRIVACY_VERSION,
      }),
    );
  });

  it("when the account has no adult to act as guardian, first saves the adult as a non-patient with the privacy accepted and then the minor under them", async () => {
    answer({
      add_my_person: [
        { data: ADULT, error: null },
        { data: MINOR, error: null },
      ],
    });

    await expect(
      addMinor(undefined, form({ ...minor, ...newGuardian, privacy: "on" })),
    ).rejects.toThrow("redirect:/mi-cuenta?aviso=menor");

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
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      "add_my_person",
      expect.objectContaining({
        p_first_name: "Leo",
        p_guardian_id: ADULT,
        p_relationship: "madre",
        p_accept_privacy: false,
      }),
    );
  });

  it("saves nobody when the child is not a minor, so no adult is left half-added in the account", async () => {
    expect(
      await addMinor(
        undefined,
        form({
          ...minor,
          birth_date: "2000-01-01",
          ...newGuardian,
          privacy: "on",
        }),
      ),
    ).toEqual({ error: "Solo puedes añadir a un menor a tu cargo." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("comes back to the form with the warning when the adult was saved but the minor was refused, so the adult is offered as guardian instead of being asked for again", async () => {
    answer({
      add_my_person: [
        { data: ADULT, error: null },
        { data: null, error: { message: "guardian_not_adult" } },
      ],
    });

    await expect(
      addMinor(undefined, form({ ...minor, ...newGuardian, privacy: "on" })),
    ).rejects.toThrow(
      "redirect:/mi-cuenta/menores/nuevo?aviso=guardian_not_adult",
    );
  });

  it("explains a database refusal, such as a guardian that is not in the account", async () => {
    answer({
      add_my_person: {
        data: null,
        error: { message: "guardian_not_in_account" },
      },
    });

    expect(
      await addMinor(undefined, form({ ...minor, guardian_id: ADULT })),
    ).toEqual({ error: "Esa persona no está en tu cuenta." });
  });
});

function person(overrides: Record<string, unknown> = {}) {
  return {
    id: ADULT,
    first_name: "Marta",
    last_name: "Ruiz",
    birth_date: "1990-04-02",
    is_minor: false,
    is_patient: true,
    relation: "self",
    ...overrides,
  };
}

function contactForm(values: Record<string, string>) {
  return form({ persona: ADULT, ...values });
}

describe("updateContact", () => {
  it("saves the normalised phone and the address of a person in the account and goes back to Mi cuenta with the notice", async () => {
    answer({ my_people: { data: [person()], error: null } });

    await expect(
      updateContact(
        undefined,
        contactForm({ phone: "611 222 333", address: " Calle Nueva 3 " }),
      ),
    ).rejects.toThrow("redirect:/mi-cuenta?aviso=contacto");

    expect(rpc).toHaveBeenCalledWith("update_my_contact", {
      p_person_id: ADULT,
      p_phone: "611222333",
      p_address: "Calle Nueva 3",
    });
  });

  it("asks again for an invalid phone without saving, so the clinic keeps a number it can call", async () => {
    answer({ my_people: { data: [person()], error: null } });

    expect(
      await updateContact(
        undefined,
        contactForm({ phone: "123", address: "" }),
      ),
    ).toEqual({ error: "Escribe un teléfono válido." });
    expect(rpc).not.toHaveBeenCalledWith(
      "update_my_contact",
      expect.anything(),
    );
  });

  it("lets a minor be left without a phone, because the clinic calls the guardian", async () => {
    answer({
      my_people: {
        data: [person({ id: MINOR, is_minor: true, relation: "ward" })],
        error: null,
      },
    });

    await expect(
      updateContact(
        undefined,
        form({ persona: MINOR, phone: "", address: "Calle Nueva 3" }),
      ),
    ).rejects.toThrow("redirect:/mi-cuenta?aviso=contacto");

    expect(rpc).toHaveBeenCalledWith("update_my_contact", {
      p_person_id: MINOR,
      p_phone: null,
      p_address: "Calle Nueva 3",
    });
  });

  it("refuses a person who is not in the account without trying to save", async () => {
    answer({ my_people: { data: [person({ id: MINOR })], error: null } });

    expect(
      await updateContact(
        undefined,
        contactForm({ phone: "611222333", address: "" }),
      ),
    ).toEqual({ error: "Esa persona no está en tu cuenta." });
    expect(rpc).not.toHaveBeenCalledWith(
      "update_my_contact",
      expect.anything(),
    );
  });

  it("explains a database refusal such as an address that is too long", async () => {
    answer({
      my_people: { data: [person()], error: null },
      update_my_contact: {
        data: null,
        error: { message: "address_too_long" },
      },
    });

    expect(
      await updateContact(
        undefined,
        contactForm({ phone: "611222333", address: "Calle Nueva 3" }),
      ),
    ).toEqual({ error: "La dirección es demasiado larga." });
  });
});
