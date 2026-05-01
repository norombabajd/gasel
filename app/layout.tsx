import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { authClient } from "@/lib/auth/client";
import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
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
      <body className={`${instrumentSans.className} antialiased`}>
        <NeonAuthUIProvider
          authClient={authClient}
          redirectTo="/"
          emailOTP
        >
          {children}
        </NeonAuthUIProvider>
      </body>
    </html>
  );
}
