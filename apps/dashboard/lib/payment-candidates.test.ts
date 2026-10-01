import { describe, expect, it } from "vitest";
import {
  candidateMoment,
  filterPaymentCandidates,
  groupPaymentCandidates,
  type PaymentCandidate,
  paymentToastMessage,
  pendingTabLabel,
} from "./payment-candidates";

function candidate(overrides: Partial<PaymentCandidate>): PaymentCandidate {
  return {
    id: "apt-1",
    startsAt: "2026-10-01T08:00:00Z",
    patientName: "Marta Paciente",
    serviceName: "Sesión",
    professionalName: "Laura Ejemplo",
    suggestedAmountCents: 4500,
    ...overrides,
  };
}

const NOW = new Date("2026-10-01T10:00:00Z");

describe("groupPaymentCandidates", () => {
  it("puts today's appointments first in time order, so reception finds the patient standing at the desk without scrolling", () => {
    const result = groupPaymentCandidates(
      [
        candidate({ id: "afternoon", startsAt: "2026-10-01T15:00:00Z" }),
        candidate({ id: "yesterday", startsAt: "2026-09-30T09:00:00Z" }),
        candidate({ id: "morning", startsAt: "2026-10-01T07:00:00Z" }),
      ],
      NOW,
    );
    expect(result.today.map((c) => c.id)).toEqual(["morning", "afternoon"]);
    expect(result.earlier.map((c) => c.id)).toEqual(["yesterday"]);
  });

  it("lists older pending appointments most recent first, because the latest unpaid visit is the likeliest to be paid now", () => {
    const result = groupPaymentCandidates(
      [
        candidate({ id: "old", startsAt: "2026-08-10T09:00:00Z" }),
        candidate({ id: "recent", startsAt: "2026-09-28T09:00:00Z" }),
      ],
      NOW,
    );
    expect(result.earlier.map((c) => c.id)).toEqual(["recent", "old"]);
  });

  it("decides «today» with the Madrid calendar, so a visit at 00:30 Madrid still counts as today", () => {
    const result = groupPaymentCandidates(
      [candidate({ id: "early", startsAt: "2026-09-30T22:30:00Z" })],
      NOW,
    );
    expect(result.today.map((c) => c.id)).toEqual(["early"]);
  });

  it("shows an appointment only once even if both loaders returned it", () => {
    const result = groupPaymentCandidates(
      [candidate({ id: "same" }), candidate({ id: "same" })],
      NOW,
    );
    expect(result.today).toHaveLength(1);
  });
});

describe("filterPaymentCandidates", () => {
  const list = [
    candidate({ id: "a", patientName: "Íñigo Martínez" }),
    candidate({ id: "b", patientName: "Nora López" }),
  ];

  it("finds a patient without caring about accents or capitals, as staff type quickly", () => {
    expect(
      filterPaymentCandidates(list, "inigo mart").map((c) => c.id),
    ).toEqual(["a"]);
  });

  it("returns every appointment while the search is empty", () => {
    expect(filterPaymentCandidates(list, "  ")).toHaveLength(2);
  });
});

describe("candidateMoment", () => {
  it("says «Hoy» for today's appointments so they read at a glance", () => {
    expect(candidateMoment("2026-10-01T08:00:00Z", NOW)).toBe("Hoy 10:00");
  });

  it("shows day and month for older appointments", () => {
    expect(candidateMoment("2026-09-28T08:00:00Z", NOW)).toBe("28/09 10:00");
  });
});

describe("pendingTabLabel", () => {
  it("shows how many appointments are waiting to be paid", () => {
    expect(pendingTabLabel(3)).toBe("Pendientes (3)");
    expect(pendingTabLabel(0)).toBe("Pendientes (0)");
  });

  it("leaves the count out when it could not be loaded, rather than claim there are none", () => {
    expect(pendingTabLabel(null)).toBe("Pendientes");
  });
});

describe("paymentToastMessage", () => {
  it("confirms the amount and payment method in plain Spanish", () => {
    expect(paymentToastMessage(4500, "cash")).toBe(
      "Cobro registrado · 45,00 € en efectivo",
    );
    expect(paymentToastMessage(4500, "card")).toBe(
      "Cobro registrado · 45,00 € con tarjeta",
    );
    expect(paymentToastMessage(4500, "bizum")).toBe(
      "Cobro registrado · 45,00 € por Bizum",
    );
    expect(paymentToastMessage(4500, "transfer")).toBe(
      "Cobro registrado · 45,00 € por transferencia",
    );
  });

  it("says «Sin cargo» for a free visit instead of «0,00 €»", () => {
    expect(paymentToastMessage(0, "cash")).toBe("Cobro registrado · Sin cargo");
  });
});
