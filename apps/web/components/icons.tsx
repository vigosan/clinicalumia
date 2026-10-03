import type { ReactNode } from "react";

type IconProps = {
  className?: string;
};

export function WhatsAppIcon({ className = "" }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M 20.4 3.49 C 18.18 1.25 15.15 -0.01 11.99 -0 C 5.44 -0 0.1 5.34 0.1 11.89 C 0.1 13.99 0.64 16.03 1.68 17.84 L 0 24 L 6.31 22.35 C 8.05 23.3 10 23.79 11.99 23.79 L 12 23.79 C 18.55 23.79 23.89 18.46 23.89 11.9 C 23.89 8.74 22.64 5.71 20.4 3.49 Z M 11.99 21.78 C 10.22 21.78 8.48 21.3 6.96 20.4 L 6.6 20.18 L 2.86 21.17 L 3.85 17.52 L 3.62 17.14 C 2.63 15.57 2.11 13.74 2.11 11.88 C 2.11 6.44 6.55 2.01 12 2.01 C 14.62 2 17.14 3.04 18.99 4.9 C 20.84 6.75 21.89 9.27 21.88 11.89 C 21.87 17.35 17.44 21.78 11.99 21.78 Z M 17.41 14.38 C 17.12 14.23 15.66 13.51 15.38 13.41 C 15.11 13.31 14.91 13.26 14.72 13.56 C 14.52 13.85 13.95 14.53 13.78 14.72 C 13.6 14.92 13.43 14.94 13.13 14.8 C 12.84 14.65 11.88 14.33 10.74 13.32 C 9.86 12.53 9.27 11.56 9.09 11.26 C 8.92 10.96 9.07 10.81 9.22 10.66 C 9.35 10.52 9.52 10.31 9.66 10.14 C 9.81 9.97 9.86 9.84 9.96 9.64 C 10.06 9.44 10.01 9.27 9.94 9.12 C 9.86 8.97 9.27 7.51 9.02 6.92 C 8.78 6.33 8.54 6.41 8.35 6.41 C 8.18 6.4 7.98 6.4 7.78 6.4 C 7.48 6.4 7.19 6.54 6.99 6.77 C 6.72 7.06 5.95 7.78 5.95 9.25 C 5.95 10.71 7.02 12.12 7.17 12.32 C 7.32 12.52 9.26 15.52 12.24 16.81 C 12.95 17.12 13.5 17.3 13.94 17.44 C 14.65 17.66 15.29 17.63 15.81 17.56 C 16.38 17.47 17.56 16.84 17.81 16.14 C 18.06 15.45 18.06 14.85 17.98 14.73 C 17.91 14.6 17.71 14.53 17.41 14.38 Z" />
    </svg>
  );
}

export function GoogleIcon({ className = "" }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="16 16 37 37.1"
      fill="currentColor"
      className={className}
    >
      <path d="M 23.41 34.53 C 23.41 39.95 27.31 44.58 32.65 45.5 C 37.99 46.41 43.21 43.34 45.01 38.23 L 34.53 38.23 L 34.53 30.82 L 52.7 30.82 L 52.7 38.23 L 52.69 38.23 C 50.97 46.69 43.49 53.06 34.53 53.06 C 24.3 53.06 16 44.76 16 34.53 C 16 24.3 24.3 16 34.53 16 C 40.68 16 46.43 19.05 49.87 24.14 L 43.8 28.39 C 41.09 24.3 36.02 22.47 31.32 23.88 C 26.63 25.29 23.41 29.62 23.41 34.53 Z" />
    </svg>
  );
}

function StrokeIcon({
  className = "",
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function ArrowRightIcon({ className = "" }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </StrokeIcon>
  );
}

export function PlusIcon({ className = "" }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M12 5v14M5 12h14" />
    </StrokeIcon>
  );
}

export function PhoneIcon({ className = "" }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </StrokeIcon>
  );
}

export function MapPinIcon({ className = "" }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </StrokeIcon>
  );
}

export function ClockIcon({ className = "" }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </StrokeIcon>
  );
}

export function CheckIcon({ className = "" }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="m5 12 5 5L20 7" />
    </StrokeIcon>
  );
}
