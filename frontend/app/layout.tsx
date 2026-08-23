import type { Metadata } from "next";
import { Libre_Baskerville } from "next/font/google";
import "./globals.css";

// Just for the marketing hero's "Nextly" headline. Bell MT (what was asked
// for) is a Monotype font sold with Microsoft Office - not something we can
// legally embed on a website, and most visitors wouldn't have it installed
// locally either. Libre Baskerville is the closest free web font in the
// same family (Bell MT was itself modeled on Baskerville).
const libreBaskerville = Libre_Baskerville({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nextly",
  description: "Welcome! Stop deciding. Start doing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={libreBaskerville.variable}>
      <body>{children}</body>
    </html>
  );
}
