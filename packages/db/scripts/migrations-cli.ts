import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import {
  localVersions,
  migrationStatus,
  promotionBlockers,
} from "./migrations";

async function appliedVersions(url: string | undefined): Promise<string[]> {
  if (!url) throw new Error("Falta DATABASE_URL de uno de los entornos.");
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const rows = await sql<{ version: string }[]>`
      select version from supabase_migrations.schema_migrations`;
    return rows.map((row) => row.version);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "42P01" || code === "3F000") return [];
    throw error;
  } finally {
    await sql.end();
  }
}

async function main() {
  const command = process.argv[2];
  const local = localVersions(
    readdirSync(resolve(import.meta.dirname, "../supabase/migrations")),
  );
  const [dev, prod] = await Promise.all([
    appliedVersions(process.env.DEV_DATABASE_URL),
    appliedVersions(process.env.PROD_DATABASE_URL),
  ]);

  if (command === "status") {
    console.table(
      migrationStatus(local, dev, prod).map((row) => ({
        migración: row.version,
        dev: row.dev ? "✓" : "pendiente",
        prod: row.prod ? "✓" : "pendiente",
      })),
    );
    return;
  }

  if (command === "check-promotable") {
    const blockers = promotionBlockers(local, dev, prod);
    if (blockers.length > 0) {
      console.error(
        `No se puede pasar a producción. Aplica antes en dev o revisa: ${blockers.join(", ")}`,
      );
      process.exit(1);
    }
    console.log("Todo lo pendiente en producción ya está aplicado en dev.");
    return;
  }

  console.error("Uso: migrations <status|check-promotable>");
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
