import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Lumia · Clínica Logopedia miofuncional",
  description:
    "Página web en construcción. Pronto disponible. Llámanos e infórmate: 614 552 808.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${fraunces.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-sage-500 text-stone-800 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
