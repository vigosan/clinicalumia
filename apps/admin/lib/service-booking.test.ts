import { describe, expect, it } from "vitest";
import {
  bookingLabel,
  hasPhoneOnlyServices,
  isPhoneOnly,
} from "./service-booking";

const deposit = {
  bookable_online: true,
  booking_payment: "fixed",
  booking_payment_value: 1000,
};

describe("isPhoneOnly", () => {
  it("marks a service that charges when booking as phone only while online payments are off, because the web cannot take the payment", () => {
    expect(isPhoneOnly(deposit, false)).toBe(true);
    expect(isPhoneOnly({ ...deposit, booking_payment: "full" }, false)).toBe(
      true,
    );
  });

  it("keeps a service bookable online when it charges nothing at booking or online payments are on", () => {
    expect(isPhoneOnly({ ...deposit, booking_payment: "none" }, false)).toBe(
      false,
    );
    expect(isPhoneOnly(deposit, true)).toBe(false);
  });

  it("does not call a service phone only when it was never offered on the web", () => {
    expect(isPhoneOnly({ ...deposit, bookable_online: false }, false)).toBe(
      false,
    );
  });
});

describe("bookingLabel", () => {
  it("says «Solo por teléfono» instead of the deposit while online payments are off, so the list matches what patients see", () => {
    expect(bookingLabel(deposit, false)).toBe("Solo por teléfono");
  });

  it("shows what is paid when booking once online payments are on", () => {
    expect(bookingLabel(deposit, true)).toBe("Señal 10,00 €");
    expect(
      bookingLabel(
        { ...deposit, booking_payment: "percent", booking_payment_value: 20 },
        true,
      ),
    ).toBe("Señal 20 %");
    expect(bookingLabel({ ...deposit, booking_payment: "full" }, true)).toBe(
      "Pago completo",
    );
  });

  it("says the patient pays at the clinic when nothing is charged at booking, and «No» when it is not on the web", () => {
    expect(bookingLabel({ ...deposit, booking_payment: "none" }, false)).toBe(
      "Paga en la clínica",
    );
    expect(bookingLabel({ ...deposit, bookable_online: false }, true)).toBe(
      "No",
    );
  });
});

describe("hasPhoneOnlyServices", () => {
  it("warns only about active services, since an inactive one is not offered to patients anyway", () => {
    expect(
      hasPhoneOnlyServices([{ ...deposit, is_active: false }], false),
    ).toBe(false);
    expect(
      hasPhoneOnlyServices(
        [
          { ...deposit, is_active: false },
          { ...deposit, is_active: true },
        ],
        false,
      ),
    ).toBe(true);
  });

  it("does not warn once online payments are on", () => {
    expect(hasPhoneOnlyServices([{ ...deposit, is_active: true }], true)).toBe(
      false,
    );
  });
});
