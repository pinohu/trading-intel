import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Intelligence Platform",
  description: "Mobile-first trading research, risk, and intelligence cockpit.",
  applicationName: "TradeIntel",
  appleWebApp: {
    capable: true,
    title: "TradeIntel",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
