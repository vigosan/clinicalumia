import localFont from "next/font/local";

export const neueHaas = localFont({
  src: [
    { path: "./fonts/NeueHaasDisplayLight.woff2", weight: "300" },
    { path: "./fonts/NeueHaasDisplayRoman.woff2", weight: "400" },
    { path: "./fonts/NeueHaasDisplayMedium.woff2", weight: "500" },
    { path: "./fonts/NeueHaasDisplayBold.woff2", weight: "700" },
    { path: "./fonts/NeueHaasDisplayBlack.woff2", weight: "900" },
  ],
  variable: "--font-neue-haas",
});
