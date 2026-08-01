import { isPending, site } from "@/lib/site";
import { WhatsAppIcon } from "./icons";

export function FloatingContact() {
  const usesWhatsApp = !isPending(site.whatsapp.href);
  const href = usesWhatsApp ? site.whatsapp.href : site.phone.href;

  return (
    <a
      href={href}
      data-testid="floating-contact"
      className="fixed right-5 bottom-5 z-40 inline-flex items-center gap-2 rounded-full bg-sage-600 px-5 py-3 text-cream-50 shadow-lg transition-colors hover:bg-sage-700 md:right-8 md:bottom-8"
    >
      <span className="text-sm md:text-base">¿Podemos ayudarte?</span>
      <WhatsAppIcon className="size-5" />
    </a>
  );
}
