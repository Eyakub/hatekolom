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
  title: "Happy Baby — Play, Learn, Grow",
  description:
    "বাংলাদেশের শিশুদের জন্য আধুনিক শিক্ষা প্ল্যাটফর্ম। ঘরে বসে শিখুন অ্যাবাকাস, ম্যাথ, কোডিং ও আরও অনেক কিছু।",
  keywords: ["education", "bangladesh", "kids", "online learning", "lms"],
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
