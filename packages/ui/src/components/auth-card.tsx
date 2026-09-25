import type { ReactNode } from "react";
import { Card } from "./card";

export function AuthCard({
  logo,
  title,
  subtitle,
  children,
}: {
  logo: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-cream-50 px-6 py-16">
      <Card className="flex w-full max-w-sm flex-col gap-6 p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          {logo}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
            {subtitle && <p className="text-sm text-ink-800">{subtitle}</p>}
          </div>
        </div>
        {children}
      </Card>
    </main>
  );
}
