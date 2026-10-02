"use client";

import { signatureFont } from "./signature-font";

const SIDE_PADDING = 24;

export async function typedSignaturePng(name: string, box: HTMLElement) {
  const text = name.trim();
  if (!text) return "";
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = box.offsetWidth;
  const height = box.offsetHeight;
  const family = signatureFont.style.fontFamily;
  const fontSize = Number.parseFloat(getComputedStyle(box).fontSize);
  await document.fonts.load(`500 ${fontSize}px ${family}`, text);

  const canvas = document.createElement("canvas");
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.scale(ratio, ratio);
  context.font = `500 ${fontSize}px ${family}`;
  const available = width - SIDE_PADDING * 2;
  const measured = context.measureText(text).width;
  const size =
    measured > available ? (fontSize * available) / measured : fontSize;
  context.font = `500 ${size}px ${family}`;
  context.fillStyle = "#3f3f3f";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, width / 2, height / 2);
  return canvas.toDataURL("image/png");
}

export function TypedSignature({
  name,
  onNameChange,
  previewRef,
}: {
  name: string;
  onNameChange: (value: string) => void;
  previewRef: React.Ref<HTMLDivElement>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-ink-600 text-sm">Escribe tu nombre</span>
        <input
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          autoComplete="off"
          data-testid="signature-typed-input"
          className="rounded-2xl border border-sage-400/60 bg-cream-50 px-4 py-3 text-base text-ink-700 outline-none focus:border-sage-600"
        />
      </label>
      <div
        ref={previewRef}
        data-testid="signature-typed-preview"
        className={`${signatureFont.className} flex h-48 w-full items-center justify-center overflow-hidden break-words rounded-2xl border border-sage-400/60 border-dashed bg-white px-6 text-center text-[#3f3f3f] text-[clamp(2.25rem,9vw,4rem)] leading-tight`}
      >
        {name}
      </div>
      <span className="text-ink-400 text-sm">
        Tu nombre escrito será tu firma
      </span>
    </div>
  );
}
