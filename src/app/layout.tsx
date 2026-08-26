import type { Metadata, Viewport } from "next";
import { Big_Shoulders, IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";

const brand = Big_Shoulders({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const score = IBM_Plex_Mono({
  variable: "--font-score",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const ui = Manrope({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Stack — points for the table tonight",
  description:
    "Phone-first poker points for Javier and friends. Set a stack, bet each street, collect when you win. Sample points only — no accounts, no money.",
  applicationName: "Stack",
  appleWebApp: {
    capable: true,
    title: "Stack",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#050910",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${brand.variable} ${score.variable} ${ui.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
