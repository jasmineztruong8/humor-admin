import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Humor Admin",
  description: "Admin area for The Humor Project.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
