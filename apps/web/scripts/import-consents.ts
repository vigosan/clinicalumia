import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Database } from "@clinicalumia/db";
import { createClient } from "@supabase/supabase-js";
import { importConsents } from "./consent-import";

function readEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta la variable ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = readEnv("SUPABASE_URL");
  const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const dir = readEnv("CONSENTS_DIR");
  const dry = process.env.DRY === "1";

  const names = (await readdir(dir))
    .filter((name) => name.toLowerCase().endsWith(".pdf"))
    .sort();
  const pdfs = await Promise.all(
    names.map(async (name) => new Uint8Array(await readFile(join(dir, name)))),
  );

  const admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const summary = await importConsents({ admin, pdfs, dry });

  const linked = Object.values(summary.linked).reduce((a, b) => a + b, 0);
  const methods = Object.entries(summary.linked)
    .map(([method, count]) => `${method}: ${count}`)
    .join(", ");
  const positions = (list: number[]) =>
    list.length ? ` (${list.map((n) => `archivo ${n}`).join(", ")})` : "";

  console.log(
    dry ? "Simulación: no se ha guardado nada." : "Importación terminada.",
  );
  console.log(`Total: ${summary.total}`);
  console.log(`Importados: ${summary.imported}`);
  console.log(`Asociados: ${linked}${methods ? ` (${methods})` : ""}`);
  console.log(`Pendientes: ${summary.pending}`);
  console.log(`Repetidos: ${summary.repeated}`);
  console.log(
    `No legibles: ${summary.unreadable.length}${positions(summary.unreadable)}`,
  );
  console.log(`Fallidos: ${summary.failed.length}${positions(summary.failed)}`);
  if (summary.failed.length) process.exit(1);
}

main().catch(() => {
  console.error("La importación ha fallado.");
  process.exit(1);
});
