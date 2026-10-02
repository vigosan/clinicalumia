import { site } from "@/lib/site";

export function LegalNotice({ document }: { document: string }) {
  return (
    <section className="px-6 py-14 md:px-12 md:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="rounded-panel border border-sage-400/60 px-8 py-10 text-ink-500 leading-relaxed">
          El texto de {document} está pendiente de redacción por parte de{" "}
          {site.name}. Debe incluir los datos identificativos del titular, el
          NIF, el domicilio social, los datos de contacto y, cuando proceda, el
          número de colegiado profesional.
        </p>
        <p className="mt-6 text-ink-400 text-sm">
          Si necesitas información sobre el tratamiento de tus datos antes de
          que se publique este documento, escríbenos al{" "}
          <a href={site.phone.href} className="underline underline-offset-2">
            {site.phone.display}
          </a>
          .
        </p>
      </div>
    </section>
  );
}
