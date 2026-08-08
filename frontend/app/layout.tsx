import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nextly",
  description: "Welcome! Stop deciding. Start doing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
