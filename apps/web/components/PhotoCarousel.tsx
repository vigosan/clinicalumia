"use client";

import Image from "next/image";
import { type ReactNode, useRef } from "react";
import { ArrowCircle } from "./icons";

export type CarouselPhoto = {
  src: string;
  alt: string;
};

export function PhotoCarousel({
  items,
  children,
}: {
  items: CarouselPhoto[];
  children: ReactNode;
}) {
  const track = useRef<HTMLUListElement>(null);

  const scroll = (direction: 1 | -1) => {
    const el = track.current;
    if (!el?.firstElementChild) return;
    const tile = el.firstElementChild.getBoundingClientRect().width;
    const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: direction * (tile + gap), behavior: "smooth" });
  };

  return (
    <div>
      <ul
        ref={track}
        data-testid="photo-carousel"
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-6 [scrollbar-width:none] md:gap-[2.656vw] md:pr-[1.667vw] md:pl-[19.427vw] scroll-pl-6 md:scroll-pl-[19.427vw]"
      >
        {items.map((photo) => (
          <li
            key={photo.src}
            className="w-[78vw] shrink-0 snap-start md:w-[29.271vw]"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              width={1124}
              height={1238}
              sizes="(min-width: 768px) 30vw, 78vw"
              className="aspect-[562/619] w-full rounded-panel object-cover"
            />
          </li>
        ))}
      </ul>

      <div
        data-testid="carousel-nav"
        className="mx-6 mt-8 flex items-center border-sage-500 border-b-2 pb-4 md:mx-[12.448vw] md:mt-[4.453vw] md:px-[2.55vw] md:pb-[1.72vw]"
      >
        <button
          type="button"
          data-testid="carousel-prev"
          aria-label="Foto anterior"
          onClick={() => scroll(-1)}
          className="cursor-pointer text-sage-500 transition-opacity hover:opacity-70"
        >
          <ArrowCircle direction="left" className="size-10 md:size-[3.49vw]" />
        </button>
        <div className="mx-auto">{children}</div>
        <button
          type="button"
          data-testid="carousel-next"
          aria-label="Foto siguiente"
          onClick={() => scroll(1)}
          className="cursor-pointer text-sage-500 transition-opacity hover:opacity-70"
        >
          <ArrowCircle className="size-10 md:size-[3.49vw]" />
        </button>
      </div>
    </div>
  );
}
