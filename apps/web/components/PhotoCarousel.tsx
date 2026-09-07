import Image from "next/image";

export type CarouselPhoto = {
  src: string;
  alt: string;
};

export function PhotoCarousel({ items }: { items: CarouselPhoto[] }) {
  return (
    <ul
      data-testid="photo-carousel"
      className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth md:gap-[2.656vw]"
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
  );
}
