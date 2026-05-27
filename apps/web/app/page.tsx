import Image from "next/image";
import { CollaboratorDrawer } from "./CollaboratorDrawer";

const PHONE_DISPLAY = "614 552 808";
const PHONE_HREF = "tel:+34614552808";

function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={`text-cream-50 ${className}`}
      fill="currentColor"
    >
      <path d="M12 0c.4 7.2 4.4 11.6 12 12-7.6.4-11.6 4.8-12 12-.4-7.2-4.4-11.6-12-12 7.6-.4 11.6-4.8 12-12z" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <section className="relative flex-1 overflow-hidden bg-sage-500">
        <Image
          src="/hero-mobile.webp"
          alt=""
          fill
          priority
          sizes="(min-width: 768px) 0px, 100vw"
          className="object-cover object-center md:hidden"
        />
        <Image
          src="/hero-desktop.webp"
          alt=""
          fill
          priority
          sizes="(min-width: 768px) 100vw, 0px"
          className="hidden object-cover object-center md:block"
        />

        <div className="relative z-10 flex h-full min-h-[600px] flex-col items-center px-6 pt-12 md:block md:min-h-[640px] md:p-0">
          <div className="md:absolute md:left-12 md:top-14">
            <Image
              src="/logo-white.png"
              alt="Lumia · Clínica Logopedia miofuncional"
              width={1080}
              height={400}
              priority
              className="h-auto w-72 md:w-72 lg:w-80"
            />
          </div>

          <div className="mt-10 flex flex-col items-center gap-5 text-cream-50 md:absolute md:right-12 md:top-20 md:mt-0 md:items-start md:gap-6">
            <h1 className="text-2xl md:text-3xl lg:text-4xl">
              Página web <span className="font-semibold">en construcción</span>
            </h1>
            <CollaboratorDrawer />
          </div>

          <Sparkle className="mt-10 size-7 md:absolute md:bottom-10 md:left-12 md:mt-0 md:size-6" />
        </div>
      </section>

      <footer className="flex flex-col items-center gap-3 bg-cream-200 px-6 py-8">
        <p className="text-sm text-stone-700">
          Llámanos e infórmate:{" "}
          <a
            href={PHONE_HREF}
            className="font-medium underline-offset-2 hover:underline"
          >
            {PHONE_DISPLAY}
          </a>
        </p>
        <Image
          src="/logo-dark.png"
          alt=""
          width={1080}
          height={400}
          className="h-auto w-40 md:w-48"
        />
      </footer>
    </>
  );
}
