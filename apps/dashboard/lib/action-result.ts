import type { ErrorLink } from "./payments";

export type ActionResult = { ok: true } | { error: string; link?: ErrorLink };
