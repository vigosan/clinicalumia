import { createClient } from "@clinicalumia/api/server";
import { Badge } from "@clinicalumia/ui/badge";
import { Button } from "@clinicalumia/ui/button";
import { EmptyState } from "@clinicalumia/ui/empty-state";
import { PageHeader } from "@clinicalumia/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@clinicalumia/ui/table";
import Link from "next/link";
import { formatCents } from "@/lib/money";
import { ServiceStatusToggle } from "./ServiceStatusToggle";

function bookingLabel(payment: string, value: number) {
  if (payment === "fixed") return `Señal ${formatCents(value)}`;
  if (payment === "percent") return `Señal ${value} %`;
  if (payment === "full") return "Pago completo";
  return "Paga en la clínica";
}

export default async function ServicesPage() {
  const supabase = await createClient();
  const [{ data: specialties }, { data: services }] = await Promise.all([
    supabase.from("specialties").select("id, name").order("name"),
    supabase
      .from("services")
      .select(
        "id, specialty_id, name, duration_minutes, price_cents, vat, bookable_online, booking_payment, booking_payment_value, is_active",
      )
      .order("name"),
  ]);

  return (
    <>
      <PageHeader
        title="Servicios"
        description="Lo que ofrece cada especialidad: duración, precio, IVA y qué se paga al reservar."
        actions={
          <Button asChild data-testid="service-new">
            <Link href="/services/new">Nuevo servicio</Link>
          </Button>
        }
      />
      {(specialties ?? []).map((specialty) => {
        const list = (services ?? []).filter(
          (s) => s.specialty_id === specialty.id,
        );
        return (
          <section key={specialty.id} className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink-900">{specialty.name}</h2>
            {list.length === 0 ? (
              <EmptyState title="Aún no hay servicios en esta especialidad." />
            ) : (
              <Table aria-label={`Servicios de ${specialty.name}`}>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Servicio</TableHeaderCell>
                    <TableHeaderCell>Duración</TableHeaderCell>
                    <TableHeaderCell>Precio</TableHeaderCell>
                    <TableHeaderCell>IVA</TableHeaderCell>
                    <TableHeaderCell>Reserva web</TableHeaderCell>
                    <TableHeaderCell>Estado</TableHeaderCell>
                    <TableHeaderCell className="relative">
                      <span className="sr-only">Acciones</span>
                    </TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.map((service) => (
                    <TableRow key={service.id} data-testid="service-row">
                      <TableCell className="font-medium max-md:text-[15px]">
                        {service.name}
                      </TableCell>
                      <TableCell label="Duración">
                        {service.duration_minutes} min
                      </TableCell>
                      <TableCell label="Precio">
                        {formatCents(service.price_cents)}
                      </TableCell>
                      <TableCell label="IVA">
                        {service.vat === "exempt" ? (
                          "Exento"
                        ) : (
                          <Badge tone="outline">21 %</Badge>
                        )}
                      </TableCell>
                      <TableCell label="Reserva web">
                        {service.bookable_online
                          ? bookingLabel(
                              service.booking_payment,
                              service.booking_payment_value,
                            )
                          : "No"}
                      </TableCell>
                      <TableCell label="Estado">
                        <Badge tone={service.is_active ? "success" : "neutral"}>
                          {service.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-md:mt-2 max-md:justify-end">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            asChild
                            size="sm"
                            variant="secondary"
                            data-testid="service-edit"
                          >
                            <Link href={`/services/${service.id}`}>Editar</Link>
                          </Button>
                          <ServiceStatusToggle
                            id={service.id}
                            isActive={service.is_active}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        );
      })}
    </>
  );
}
