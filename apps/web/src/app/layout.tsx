import "./globals.css";
import type { Metadata, Viewport } from "next";
import Providers from "./providers";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Colour Dice Arena",
  description:
    "A provably-fair multiplayer colour dice game. Tap to reveal your colour — Red, Black, Blue, Green, Yellow or White.",
};

export const viewport: Viewport = {
  themeColor: "#0B0B12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-zinc-100 antialiased">
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
