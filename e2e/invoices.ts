import { execFileSync } from "node:child_process";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
