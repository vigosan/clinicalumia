import Image from "next/image";
import Link from "next/link";
import { isPending, site } from "@/lib/site";

const rows = [
  { href: isPending(site.maps) ? "/contacto" : site.maps, label: "Dirección" },
  {
    href: isPending(site.whatsapp.href) ? site.phone.href : site.whatsapp.href,
    label: "WhatsApp",
  },
  { href: "/contacto", label: "Horario" },
  { href: "/servicios", label: "Servicios profesionales" },
  { href: "/aviso-legal", label: "Bases legales" },
];

export function SiteFooter() {
  return (
    <footer className="bg-sage-500 px-6 py-14 md:px-[5.625vw] md:pt-[4.635vw] md:pb-[12.08vw]">
      <Image
        src="/logo-white.png"
        alt="LUMIA · Clínica Logopedia miofuncional"
        width={1080}
        height={400}
        className="h-auto w-44 md:w-[22.292vw]"
      />

      <ul className="mt-12 max-w-xl md:mt-[1.927vw] md:ml-[3.698vw] md:max-w-[28.698vw]">
        {rows.map((row) => (
          <li key={row.label} className="border-cream-50 border-b">
            <Link
              href={row.href}
              className="block pt-5 pb-3 text-body text-cream-50 transition-opacity hover:opacity-70 md:pt-[1.44vw] md:pb-[0.72vw]"
            >
              {row.label}
            </Link>
          </li>
        ))}
      </ul>
    </footer>
  );
}
