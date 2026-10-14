import type { Metadata, Viewport } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// Distinctive pairing : optical serif display + clean grotesk body.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AI Reef Doctor — your AI vet for reef & saltwater tanks",
    template: "%s · AI Reef Doctor",
  },
  description:
    "Diagnose fish disease, coral health, algae & water-chemistry problems from chat and photos. Track parameters, calculate dosing, and get treatment plans — grounded, careful, reef-expert AI.",
  applicationName: "AI Reef Doctor",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "AI Reef Doctor",
    description:
      "An AI veterinarian for your saltwater reef tank — diagnosis from chat & photos, parameter intelligence, dosing & treatment plans.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#061a2a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen bg-ocean-depth">{children}</body>
    </html>
  );
}
