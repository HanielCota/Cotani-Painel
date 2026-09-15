"use client";

import Script from "next/script";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface TurnstileWidgetHandle {
  reset(): void;
}

interface TurnstileWidgetProps {
  action: "authentication" | "password-change";
  onTokenChange(token: string | null): void;
}

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ action, onTokenChange }, ref) {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [scriptReady, setScriptReady] = useState(false);

    useImperativeHandle(ref, () => ({
      reset() {
        if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
        onTokenChange(null);
      },
    }), [onTokenChange]);

    useEffect(() => {
      if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        appearance: "interaction-only",
        size: "flexible",
        theme: "auto",
        language: "pt-br",
        callback: (token: string) => onTokenChange(token),
        "expired-callback": () => onTokenChange(null),
        "error-callback": () => onTokenChange(null),
      });
      return () => {
        if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      };
    }, [action, onTokenChange, scriptReady, siteKey]);

    if (!siteKey) return null;
    return (
      <>
        <Script
          id="cloudflare-turnstile"
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
        />
        <div ref={containerRef} className="min-h-0 w-full" role="group" aria-label="Verificação de segurança" />
      </>
    );
  },
);
