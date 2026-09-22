import { pendingPattern } from "@/lib/consent-legal";

export function PendingText({ text }: { text: string }) {
  return text
    .split(pendingPattern)
    .filter(Boolean)
    .map((part) =>
      pendingPattern.test(part) ? (
        <mark
          key={part}
          data-testid="pending"
          className="rounded bg-red-100 px-1 font-medium text-red-700"
        >
          {part}
        </mark>
      ) : (
        <span key={part}>{part}</span>
      ),
    );
}
