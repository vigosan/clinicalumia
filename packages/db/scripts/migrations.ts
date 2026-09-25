export type MigrationRow = { version: string; dev: boolean; prod: boolean };

export function localVersions(fileNames: string[]): string[] {
  return fileNames
    .map((name) => /^(\d{14})_.+\.sql$/.exec(name)?.[1])
    .filter((version): version is string => Boolean(version))
    .sort();
}

export function migrationStatus(
  local: string[],
  dev: string[],
  prod: string[],
): MigrationRow[] {
  return local.map((version) => ({
    version,
    dev: dev.includes(version),
    prod: prod.includes(version),
  }));
}

export type ConfiguredEnvironments = { dev: boolean; prod: boolean };
export type MigrationStatusDisplayRow = {
  version: string;
  dev: string;
  prod: string;
};

export function formatMigrationStatus(
  rows: MigrationRow[],
  configured: ConfiguredEnvironments,
): MigrationStatusDisplayRow[] {
  return rows.map((row) => ({
    version: row.version,
    dev: configured.dev ? (row.dev ? "✓" : "pendiente") : "sin configurar",
    prod: configured.prod ? (row.prod ? "✓" : "pendiente") : "sin configurar",
  }));
}

export function promotionBlockers(
  local: string[],
  dev: string[],
  prod: string[],
): string[] {
  const untested = local.filter(
    (version) => !prod.includes(version) && !dev.includes(version),
  );
  const unknown = prod.filter((version) => !local.includes(version));
  return [...untested, ...unknown].sort();
}
