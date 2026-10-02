"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { CaptchaAction } from "@/lib/turnstile";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: { sitekey: string; action: string },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function Turnstile({
  siteKey,
  action,
}: {
  siteKey: string;
  action: CaptchaAction;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const api = window.turnstile;
    if (!loaded || !api || !container.current) return;
    const widgetId = api.render(container.current, {
      sitekey: siteKey,
      action,
    });
    return () => api.remove(widgetId);
  }, [loaded, siteKey, action]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setLoaded(true)}
      />
      <div ref={container} data-testid="captcha" />
    </>
  );
}
