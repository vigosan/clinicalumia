import type { PaymentFailure } from "@/lib/payments";

export function ActionError({
  failure,
  testId,
}: {
  failure: PaymentFailure;
  testId: string;
}) {
  return (
    <p
      role="alert"
      data-testid={testId}
      className="text-[13px] text-danger-600"
    >
      {failure.error}
      {failure.link && (
        <>
          {" "}
          <a
            href={failure.link.href}
            target="_blank"
            rel="noopener"
            data-testid={`${testId}-link`}
            className="font-medium underline"
          >
            {failure.link.label}
          </a>
        </>
      )}
    </p>
  );
}
