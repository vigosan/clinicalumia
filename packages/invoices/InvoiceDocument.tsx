import { fileURLToPath } from "node:url";
import {
  Document,
  Font,
  Image,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  formatEuros,
  formatMadridDate,
  formatSessionDate,
  paymentSummary,
} from "./format";
import { AEAT_QR_LABEL } from "./qr";
import type { InvoiceDetail, InvoiceRelated, InvoiceSnapshot } from "./types";

function packaged(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

Font.register({
  family: "NeueHaas",
  fonts: [
    { src: packaged("./fonts/NeueHaasDisplayLight.ttf"), fontWeight: 300 },
    { src: packaged("./fonts/NeueHaasDisplayRoman.ttf"), fontWeight: 400 },
    { src: packaged("./fonts/NeueHaasDisplayMedium.ttf"), fontWeight: 500 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

export const DEFAULT_LOGO_PATH = packaged("./assets/logo-dark.png");

const color = {
  ink: "#3a3a3a",
  grey: "#9a9a9a",
  rule: "#e0dbd3",
  bark: "#5b483a",
};

export const QR_COLOR = color.ink;

const QR_SIZE = (30 / 25.4) * 72;

const s = StyleSheet.create({
  page: {
    fontFamily: "NeueHaas",
    fontWeight: 300,
    fontSize: 9,
    color: color.ink,
    paddingTop: 64,
    paddingBottom: 90,
    paddingHorizontal: 64,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logo: {
    width: 120,
    height: 120 * (400 / 1080),
    marginLeft: -10,
    marginTop: -8,
    objectFit: "contain",
    objectPosition: "left",
  },
  headerRight: { alignItems: "flex-end", maxWidth: 280 },
  headerText: { alignItems: "flex-end", height: 52 },
  title: { fontSize: 16, fontWeight: 300 },
  date: { marginTop: 6, color: color.grey },
  reference: { marginTop: 4, color: color.grey, fontSize: 8 },
  partiesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 48,
  },
  parties: { flex: 1, flexDirection: "row", marginRight: 24 },
  party: { flex: 1, marginRight: 24 },
  lastParty: { flex: 1 },
  label: { fontSize: 7.5, color: color.grey, marginBottom: 6 },
  name: { fontWeight: 400, marginBottom: 3 },
  line: { color: color.grey, marginTop: 2 },
  concept: {
    marginTop: 64,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  conceptText: { flex: 1, marginRight: 40 },
  conceptTitle: { fontWeight: 400, fontSize: 10 },
  conceptSub: { color: color.grey, marginTop: 4 },
  conceptAmount: { fontSize: 10, fontWeight: 400 },
  breakdown: { marginTop: 40, alignSelf: "flex-end", width: 180 },
  breakRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  breakText: { color: color.grey },
  total: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: color.rule,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  totalLabel: { fontSize: 10, fontWeight: 400, marginBottom: 2 },
  totalValue: { fontSize: 18, fontWeight: 300, color: color.bark },
  notes: { marginTop: 48 },
  note: { color: color.grey, fontSize: 8, marginBottom: 4 },
  footer: { position: "absolute", left: 64, right: 64, bottom: 40 },
  qrBlock: { alignItems: "center", width: QR_SIZE },
  qrLabel: { color: color.grey, marginBottom: 6 },
  qr: { width: QR_SIZE, height: QR_SIZE },
  footerRow: { flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: color.grey, maxWidth: 400 },
});

function invoiceTitle(detail: InvoiceDetail): string {
  if (detail.kind === "simplified")
    return `Factura simplificada ${detail.code}`;
  if (detail.kind === "rectifying")
    return `Factura rectificativa ${detail.code}`;
  return `Factura ${detail.code}`;
}

function referenceLine(
  detail: InvoiceDetail,
  snapshot: InvoiceSnapshot,
  related: InvoiceRelated,
): string {
  if (detail.kind === "rectifying") {
    if (snapshot.rectifies)
      return `Rectifica la factura ${snapshot.rectifies.code} del ${formatSessionDate(snapshot.rectifies.issued_on)}`;
    const code = related.rectifies?.code;
    return code ? `Rectifica la factura ${code}` : "";
  }
  if (related.replaces) {
    return `Sustituye a la factura simplificada ${related.replaces.code}`;
  }
  return "";
}

function joinFilled(parts: string[], separator: string): string {
  return parts.filter((part) => part.trim() !== "").join(separator);
}

function issuerLines(issuer: InvoiceSnapshot["issuer"]): string[] {
  const place = joinFilled([issuer.postal_code, issuer.city], " ");
  return [
    `NIF ${issuer.tax_id}`,
    issuer.address_line,
    issuer.province ? `${place} (${issuer.province})` : place,
    joinFilled([issuer.phone, issuer.email], " · "),
  ].filter((line) => line.trim() !== "");
}

function recipientLines(
  recipient: NonNullable<InvoiceSnapshot["recipient"]>,
): string[] {
  return [
    `NIF ${recipient.tax_id}`,
    recipient.address,
    joinFilled([recipient.postal_code, recipient.city], " "),
  ].filter((line) => line.trim() !== "");
}

type InvoiceDocumentProps = {
  detail: InvoiceDetail;
  logo: string | { data: Buffer; format: "png" | "jpg" };
  qr: string;
};

export function renderInvoiceDocument(
  props: InvoiceDocumentProps,
): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument {...props} />);
}

function InvoiceDocument({ detail, logo, qr }: InvoiceDocumentProps) {
  const snapshot = detail.snapshot as unknown as InvoiceSnapshot;
  const related = detail.related as unknown as InvoiceRelated;
  const title = invoiceTitle(detail);
  const reference = referenceLine(detail, snapshot, related);
  const reason = detail.kind === "rectifying" ? detail.reason : "";
  const showBreakdown = snapshot.totals.vat_cents !== 0;
  const notes = [
    snapshot.vat_note,
    detail.kind === "rectifying" ? "" : paymentSummary(snapshot.payments),
    reason ? `Motivo: ${reason}` : "",
  ].filter((note) => note.trim() !== "");

  return (
    <Document title={title} author={snapshot.issuer.name}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Image style={s.logo} src={logo} />
          <View style={s.headerRight}>
            <View style={s.headerText}>
              <Text style={s.title}>{title}</Text>
              <Text style={s.date}>{formatMadridDate(detail.issued_at)}</Text>
              {reference !== "" && <Text style={s.reference}>{reference}</Text>}
            </View>
          </View>
        </View>

        <View style={s.partiesRow}>
          <View style={s.parties}>
            <View style={snapshot.recipient ? s.party : s.lastParty}>
              {snapshot.recipient && <Text style={s.label}> </Text>}
              <Text style={s.name}>{snapshot.issuer.name}</Text>
              {issuerLines(snapshot.issuer).map((line) => (
                <Text key={line} style={s.line}>
                  {line}
                </Text>
              ))}
            </View>
            {snapshot.recipient && (
              <View style={s.lastParty}>
                <Text style={s.label}>Para</Text>
                <Text style={s.name}>{snapshot.recipient.name}</Text>
                {recipientLines(snapshot.recipient).map((line) => (
                  <Text key={line} style={s.line}>
                    {line}
                  </Text>
                ))}
              </View>
            )}
          </View>
          <View style={s.qrBlock}>
            <Text style={s.qrLabel}>{AEAT_QR_LABEL}</Text>
            <Image style={s.qr} src={qr} />
          </View>
        </View>

        {snapshot.lines.map((line) => (
          <View
            key={`${line.session_date}-${line.description}`}
            style={s.concept}
            wrap={false}
          >
            <View style={s.conceptText}>
              <Text style={s.conceptTitle}>{line.description}</Text>
              <Text style={s.conceptSub}>
                {joinFilled(
                  [formatSessionDate(line.session_date), line.patient],
                  " · ",
                )}
              </Text>
            </View>
            <Text style={s.conceptAmount}>{formatEuros(line.base_cents)}</Text>
          </View>
        ))}

        <View style={s.breakdown} wrap={false}>
          {showBreakdown && (
            <>
              <View style={s.breakRow}>
                <Text style={s.breakText}>Base</Text>
                <Text style={s.breakText}>
                  {formatEuros(snapshot.totals.base_cents)}
                </Text>
              </View>
              <View style={s.breakRow}>
                <Text style={s.breakText}>IVA 21 %</Text>
                <Text style={s.breakText}>
                  {formatEuros(snapshot.totals.vat_cents)}
                </Text>
              </View>
            </>
          )}
          <View style={s.total}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>
              {formatEuros(snapshot.totals.total_cents)}
            </Text>
          </View>
        </View>

        {notes.length > 0 && (
          <View style={s.notes} wrap={false}>
            {notes.map((note) => (
              <Text key={note} style={s.note}>
                {note}
              </Text>
            ))}
          </View>
        )}

        <View style={s.footer} fixed>
          <View style={s.footerRow}>
            <Text style={s.footerText}>
              {joinFilled(
                [
                  snapshot.footer,
                  snapshot.issuer.website
                    .replace(/^https?:\/\//, "")
                    .replace(/\/$/, ""),
                ],
                " · ",
              )}
            </Text>
            <Text
              style={s.footerText}
              render={({ pageNumber, totalPages }) =>
                `${pageNumber} / ${totalPages}`
              }
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
