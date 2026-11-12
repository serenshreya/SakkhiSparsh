import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DermScreen — AI Dermatological Pre-Screening",
  description: "Clinical decision-support tool for dermatological pre-screening with integrative Ayurveda and modern medicine recommendations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
