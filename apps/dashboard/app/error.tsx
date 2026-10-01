"use client";

import { PageError } from "./PageError";

export default function RootError({ reset }: { reset: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-cream-50 px-4">
      <PageError reset={reset} />
    </main>
  );
}
