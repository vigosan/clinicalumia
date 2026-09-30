import { execFileSync } from "node:child_process";
import { todayInMadrid } from "@clinicalumia/api/madrid-time";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function madridYear(): number {
  return Number(todayInMadrid().slice(0, 4));
}

export function deleteInvoicesOfAppointments(appointmentIds: string[]) {
  if (appointmentIds.length === 0) return;
  if (!appointmentIds.every((id) => UUID.test(id)))
    throw new Error("Solo se borran facturas de citas con un id válido");
  const ids = appointmentIds.map((id) => `'${id}'`).join(", ");
  const invoices = `select i.id from public.invoices i join public.payments p on p.id = i.payment_id where p.appointment_id in (${ids})`;
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_clinicalumia",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    {
      input: [
        "begin;",
        "set local session_replication_role = replica;",
        `delete from public.invoice_emails where invoice_id in (${invoices});`,
        `delete from public.invoice_records where invoice_id in (${invoices});`,
        `delete from public.invoices where id in (${invoices});`,
        "commit;",
      ].join("\n"),
    },
  );
}

export function deleteInvoiceSeries(code: "main" | "rectifying", year: number) {
  if (code !== "main" && code !== "rectifying")
    throw new Error("Serie no válida");
  if (!Number.isInteger(year) || year <= madridYear())
    throw new Error("Solo se borran series de años futuros de prueba");
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_clinicalumia",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    {
      input: [
        "begin;",
        "set local session_replication_role = replica;",
        `delete from public.invoice_series where code = '${code}' and year = ${year};`,
        "commit;",
      ].join("\n"),
    },
  );
}

export function lockNextYearInvoiceSeries(
  code: "main" | "rectifying",
  format: string,
) {
  const year = madridYear() + 1;
  if (!/^[A-Za-z0-9/_.{}:ñ-]+$/.test(format))
    throw new Error("Formato no válido para la prueba");
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_clinicalumia",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    {
      input: [
        "begin;",
        `insert into public.invoice_series (code, year, format, next_number, configured) values ('${code}', ${year}, '${format}', 5, true);`,
        `select public.next_invoice_number('${code}', make_timestamptz(${year}, 6, 1, 12, 0, 0, 'Europe/Madrid'));`,
        "commit;",
      ].join("\n"),
    },
  );
  return year;
}
