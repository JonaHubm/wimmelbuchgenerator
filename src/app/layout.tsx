import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wimmelbuch Generator",
  description: "Create personalized hidden-object picture books from your own places and search targets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
