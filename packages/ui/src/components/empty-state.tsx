import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: Omit<ComponentProps<"div">, "title"> & {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-line border-dashed bg-surface px-6 py-10 text-center",
        className,
      )}
      {...props}
    >
      {icon && (
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full bg-sage-100 text-sage-800 [&_svg]:size-5"
        >
          {icon}
        </span>
      )}
      <div className="flex max-w-md flex-col gap-1">
        <p className="font-medium text-[15px] text-ink-900">{title}</p>
        {description && (
          <p className="text-[13px] text-ink-800">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
