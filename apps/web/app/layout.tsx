import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clínica Lumia Xàtiva",
  description: "Atención médica de calidad en Xàtiva. Próximamente.",
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
