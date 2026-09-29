import { PageHero } from "@/components/PageHero";
import { confirmLink } from "../actions";

export default async function ConfirmarPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; next?: string }>;
}) {
  const { token_hash, next } = await searchParams;

  return (
    <>
      <PageHero />
      <section className="px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto max-w-md">
          <h1 className="font-bold text-ink-600 text-section">
            Entra en tu cuenta
          </h1>
          <p className="mt-3 mb-8 text-ink-500">
            Pulsa el botón para terminar de entrar en Clínica LUMIA.
          </p>

          <form action={confirmLink}>
            <input type="hidden" name="token_hash" value={token_hash ?? ""} />
            <input type="hidden" name="next" value={next ?? ""} />
            <button
              type="submit"
              data-testid="access-confirm"
              className="cursor-pointer rounded-full bg-sage-600 px-8 py-3 text-cream-50 transition-colors hover:bg-sage-700"
            >
              Entrar
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
