import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dashboard | Clínica Lumia",
  description: "Panel de gestión de la Clínica Lumia",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.className} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
