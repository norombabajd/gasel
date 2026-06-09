import type { Metadata } from "next";
import { Instrument_Sans, Cal_Sans } from "next/font/google";
import { authClient } from "@/lib/auth/client";
import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const calSans = Cal_Sans({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal"],
  display: "swap",
  variable: "--font-cal-sans",
  // Cal Sans isn't in Next's font-metrics DB, so let it use our own
  // fallback stack instead of trying (and failing) to synthesize override metrics.
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Gasel",
  description: "GACIOD Framework Assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${instrumentSans.className} ${calSans.variable} antialiased`}>
        <NeonAuthUIProvider
          authClient={authClient}
          redirectTo="/"
          emailOTP
          credentials={false}
          localization={{
            SIGN_IN: "Welcome to Gazelle",
            SIGN_IN_DESCRIPTION:
              "Enter your email and we'll send you a one-time sign-in code.",
          }}
        >
          {children}
        </NeonAuthUIProvider>
      </body>
    </html>
  );
}
