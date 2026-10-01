import { CircleAlert } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

const TONES = {
  danger: {
    role: "alert",
    className: "border-danger-600/25 bg-danger-100/60 text-danger-700",
  },
  warning: {
    role: "status",
    className: "border-warning-800/25 bg-warning-100 text-warning-800",
  },
};

export function Alert({
  title,
  tone = "danger",
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "title"> & {
  title?: string;
  tone?: "danger" | "warning";
}) {
  return (
    <div
      role={TONES[tone].role}
      className={cn(
        "flex items-start gap-3 rounded-card border px-5 py-4 text-[15px]",
        TONES[tone].className,
        className,
      )}
      {...props}
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="flex min-w-0 flex-col gap-0.5">
        {title && <p className="font-medium">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
