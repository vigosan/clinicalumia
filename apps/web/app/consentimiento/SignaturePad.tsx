"use client";

import { useEffect, useRef, useState } from "react";

export function SignaturePad({ name }: { name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    el.width = el.offsetWidth * ratio;
    el.height = el.offsetHeight * ratio;
    const context = el.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#3f3f3f";
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = point(event);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x, y);
    context.stroke();
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
  };

  const end = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    setValue(event.currentTarget.toDataURL("image/png"));
  };

  const clear = () => {
    const el = canvas.current;
    el?.getContext("2d")?.clearRect(0, 0, el.width, el.height);
    setValue("");
  };

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvas}
        data-testid="signature-pad"
        aria-label="Firma"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="h-48 w-full touch-none rounded-2xl border border-sage-400/60 border-dashed bg-white"
      />
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center justify-between text-ink-400 text-sm">
        <span>Firma aquí con el dedo o el ratón</span>
        <button
          type="button"
          data-testid="signature-clear"
          onClick={clear}
          className="cursor-pointer underline underline-offset-2"
        >
          Borrar firma
        </button>
      </div>
    </div>
  );
}
