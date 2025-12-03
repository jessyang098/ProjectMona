import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Mona - AI Companion",
  description: "Your personal AI companion with personality and emotion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
