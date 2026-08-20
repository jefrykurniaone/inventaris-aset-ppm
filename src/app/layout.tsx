import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

/**
 * Placeholder root layout. The application shell, locale provider, and theme
 * toggle each arrive with their own ticket; `lang` is hardcoded to the default
 * locale until `next-intl` lands.
 */
export const metadata: Metadata = {
  title: "Inventaris Aset — Direktorat PPM",
  description:
    "Inventaris aset berbasis QR untuk Direktorat PPM, Telkom University.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
