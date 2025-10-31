import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YB Invoice Maker",
  description: "Aplikasi modern untuk pembuatan dan pengelolaan invoice",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${inter.variable} antialiased bg-background text-foreground`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
