"use client";

import { PageError } from "../PageError";

export default function AppError({ reset }: { reset: () => void }) {
  return <PageError reset={reset} />;
}
