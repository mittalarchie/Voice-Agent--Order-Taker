import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smash & Go — Voice Order",
  description: "Order by voice from the Smash & Go menu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
