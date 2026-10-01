import { CircleAlert } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Alert({
  title,
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "title"> & { title?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-card border border-danger-600/25 bg-danger-100/60 px-5 py-4 text-[15px] text-danger-700",
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
