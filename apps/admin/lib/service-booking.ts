import { formatCents } from "./money";

export type ServiceBooking = {
  bookable_online: boolean;
  booking_payment: string;
  booking_payment_value: number;
};

export function isPhoneOnly(
  service: ServiceBooking,
  onlinePaymentsEnabled: boolean,
): boolean {
  return (
    service.bookable_online &&
    service.booking_payment !== "none" &&
    !onlinePaymentsEnabled
  );
}

export function bookingLabel(
  service: ServiceBooking,
  onlinePaymentsEnabled: boolean,
): string {
  if (!service.bookable_online) return "No";
  if (isPhoneOnly(service, onlinePaymentsEnabled)) return "Solo por teléfono";
  if (service.booking_payment === "fixed")
    return `Señal ${formatCents(service.booking_payment_value)}`;
  if (service.booking_payment === "percent")
    return `Señal ${service.booking_payment_value} %`;
  if (service.booking_payment === "full") return "Pago completo";
  return "Paga en la clínica";
}

export function hasPhoneOnlyServices(
  services: (ServiceBooking & { is_active: boolean })[],
  onlinePaymentsEnabled: boolean,
): boolean {
  return services.some(
    (service) =>
      service.is_active && isPhoneOnly(service, onlinePaymentsEnabled),
  );
}
