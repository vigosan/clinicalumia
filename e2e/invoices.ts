import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
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

export function collectAsStaff(
  professionalId: string,
  appointmentId: string,
  amountCents: number,
) {
  if (![professionalId, appointmentId].every((id) => UUID.test(id)))
    throw new Error("Solo se cobra con ids válidos");
  if (!Number.isInteger(amountCents)) throw new Error("Importe no válido");
  const sessionId = randomUUID();
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
        `insert into auth.sessions (id, user_id, created_at, updated_at) values ('${sessionId}', '${professionalId}', now(), now());`,
        `select set_config('request.jwt.claims', json_build_object('sub', '${professionalId}', 'role', 'authenticated', 'aal', 'aal2', 'session_id', '${sessionId}')::text, true);`,
        "set local role authenticated;",
        `select public.collect_payment('${appointmentId}', ${amountCents}, 'card', '');`,
        "commit;",
      ].join("\n"),
    },
  );
}

function asStaff(professionalId: string, statement: string) {
  if (!UUID.test(professionalId)) throw new Error("Profesional no válido");
  const sessionId = randomUUID();
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
        `insert into auth.sessions (id, user_id, created_at, updated_at) values ('${sessionId}', '${professionalId}', now(), now());`,
        `select set_config('request.jwt.claims', json_build_object('sub', '${professionalId}', 'role', 'authenticated', 'aal', 'aal2', 'session_id', '${sessionId}')::text, true);`,
        "set local role authenticated;",
        statement,
        "commit;",
      ].join("\n"),
    },
  );
}

function simplifiedInvoiceOf(appointmentId: string): string {
  if (!UUID.test(appointmentId)) throw new Error("Cita no válida");
  return `(select i.id from public.invoices i join public.payments p on p.id = i.payment_id where p.appointment_id = '${appointmentId}' and i.kind = 'simplified')`;
}

export function replaceWithFullInvoiceAsStaff(
  professionalId: string,
  appointmentId: string,
  recipient: { name: string; taxId: string },
) {
  if (
    !/^[\p{L} ]+$/u.test(recipient.name) ||
    !/^[0-9A-Z]+$/.test(recipient.taxId)
  )
    throw new Error("Destinatario no válido");
  asStaff(
    professionalId,
    `select public.issue_full_invoice(${simplifiedInvoiceOf(appointmentId)}, jsonb_build_object('name', '${recipient.name}', 'tax_id', '${recipient.taxId}', 'address', 'Calle de la Factura 7', 'postal_code', '46800', 'city', 'Xàtiva'));`,
  );
}

export function rectifyAsStaff(professionalId: string, appointmentId: string) {
  asStaff(
    professionalId,
    `select public.issue_rectifying_invoice(${simplifiedInvoiceOf(appointmentId)}, 'Cobro duplicado');`,
  );
}

export function moveInvoicesOfAppointmentsTo(
  appointmentIds: string[],
  year: number,
  month: number,
) {
  if (!appointmentIds.every((id) => UUID.test(id)))
    throw new Error("Solo se mueven facturas de citas con un id válido");
  if (![year, month].every(Number.isInteger))
    throw new Error("Fecha no válida");
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
        `update public.invoices set issued_at = issued_at + (make_timestamptz(${year}, ${month}, 15, 12, 0, 0, 'Europe/Madrid') - (select min(issued_at) from public.invoices where id in (${invoices}))) where id in (${invoices});`,
        "commit;",
      ].join("\n"),
    },
  );
}
