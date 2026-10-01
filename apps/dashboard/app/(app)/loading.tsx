export default function AppLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="page-loading"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Cargando…</span>
      <div className="h-9 w-64 max-w-full animate-pulse rounded-lg bg-cream-200" />
      <div className="h-48 animate-pulse rounded-card bg-surface" />
    </div>
  );
}
