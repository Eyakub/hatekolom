import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/components/layout/ToastProvider";
import { SiteSettingsProvider } from "@/components/layout/SiteSettingsProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Hate Kolom — খেলো, শেখো, বড়ো হও",
  description:
    "শিশুদের জন্য মজার স্টিকার বই, কালারিং বুক ও শিক্ষামূলক বই — সাথে অনলাইন এক্সাম। হাতে কলম দিয়ে শেখা শুরু হোক!",
  keywords: ["hate kolom", "sticker book", "coloring book", "kids books", "online exam", "bangladesh", "educational materials"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" dir="ltr">
      <head>
        {/* Bengali font from Google Fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        <SiteSettingsProvider />
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
