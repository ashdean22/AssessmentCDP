import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pulse CDP",
  description: "One profile per reader: newsletter, web and app.",
};

// Explicit props type: the generated `LayoutProps` global only exists after a
// local `next dev`/`next build`, so relying on it broke `tsc` in CI.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="app-bg min-h-full flex flex-col">{children}</body>
    </html>
  );
}
