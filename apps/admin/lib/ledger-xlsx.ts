import ExcelJS from "exceljs";
import type { Quarter } from "./quarter";
import {
  ledgerRows,
  QUARTER_TOTALS_NOTE,
  type QuarterInvoice,
  summarizeInvoices,
  vatRateLabel,
} from "./quarter-summary";

const EUROS = "#,##0.00 €";

const LEDGER_COLUMNS: { header: string; width: number; numFmt?: string }[] = [
  { header: "Fecha", width: 12, numFmt: "dd/mm/yyyy" },
  { header: "Número", width: 12 },
  { header: "Tipo", width: 14 },
  { header: "Sustituye a / Rectifica a", width: 24 },
  { header: "Estado", width: 40 },
  { header: "Cliente", width: 28 },
  { header: "NIF", width: 12 },
  { header: "Concepto", width: 40 },
  { header: "Base", width: 12, numFmt: EUROS },
  { header: "% IVA", width: 8 },
  { header: "Cuota IVA", width: 12, numFmt: EUROS },
  { header: "Total", width: 12, numFmt: EUROS },
  { header: "Suma en totales", width: 16 },
  { header: "Exención", width: 40 },
  { header: "Forma de pago", width: 22 },
];

function calendarDate(ddmmyyyy: string): Date {
  const [day, month, year] = ddmmyyyy.split("/").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day));
}

function latestIssuer(invoices: QuarterInvoice[]) {
  const latest = invoices.reduce<QuarterInvoice | undefined>(
    (current, invoice) =>
      !current || Date.parse(invoice.issued_at) > Date.parse(current.issued_at)
        ? invoice
        : current,
    undefined,
  );
  return latest?.snapshot.issuer;
}

function addLedgerSheet(
  workbook: ExcelJS.Workbook,
  invoices: QuarterInvoice[],
) {
  const sheet = workbook.addWorksheet("Facturas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = LEDGER_COLUMNS.map(({ header, width, numFmt }) => ({
    header,
    width,
    style: numFmt ? { numFmt } : {},
  }));
  sheet.getRow(1).font = { bold: true };
  for (const row of ledgerRows(invoices)) {
    sheet.addRow([
      calendarDate(row.date),
      row.code,
      row.type,
      row.related,
      row.status,
      row.client,
      row.taxId,
      row.concept,
      row.base_cents / 100,
      row.vat_rate,
      row.vat_cents / 100,
      row.total_cents / 100,
      row.inTotals ? "Sí" : "No",
      row.exemption,
      row.paymentMethod,
    ]);
  }
}

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  {
    year,
    q,
    invoices,
  }: { year: number; q: Quarter; invoices: QuarterInvoice[] },
) {
  const sheet = workbook.addWorksheet("Resumen");
  sheet.columns = [{ width: 18 }, { width: 28 }, { width: 14 }, { width: 14 }];
  const summary = summarizeInvoices(invoices);
  const issuer = latestIssuer(invoices);

  sheet.addRow(["Trimestre", `T${q} ${year}`]);
  sheet.addRow(["Emisor", issuer?.name ?? ""]);
  sheet.addRow(["NIF", issuer?.tax_id ?? ""]);
  sheet.addRow([]);
  sheet.addRow(["Simplificadas", summary.counts.simplified]);
  sheet.addRow(["Completas", summary.counts.full]);
  sheet.addRow(["Rectificativas", summary.counts.rectifying]);
  sheet.addRow(["Sustituidas", summary.counts.replaced]);
  sheet.addRow([]);
  sheet.addRow(["IVA", "Base", "Cuota IVA", "Total"]).font = { bold: true };
  const amountRows = summary.vatRates.map((rate) =>
    sheet.addRow([
      vatRateLabel(rate.vat_rate),
      rate.base_cents / 100,
      rate.vat_cents / 100,
      rate.total_cents / 100,
    ]),
  );
  const net = sheet.addRow(["Total neto", null, null, summary.net_cents / 100]);
  net.font = { bold: true };
  sheet.addRow([]);
  sheet.addRow(["Nota", QUARTER_TOTALS_NOTE]);
  for (const row of [...amountRows, net]) {
    for (const column of [2, 3, 4]) row.getCell(column).numFmt = EUROS;
  }
}

export async function ledgerXlsx(quarter: {
  year: number;
  q: Quarter;
  invoices: QuarterInvoice[];
}): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LUMIA";
  addLedgerSheet(workbook, quarter.invoices);
  addSummarySheet(workbook, quarter);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
