import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "boxspreads.app — Borrow at Near-Treasury Rates",
  description:
    "Calculate box spread borrowing rates, compare to margin loans and HELOCs, and build error-proof orders for IBKR, Fidelity, and Schwab.",
  openGraph: {
    title: "boxspreads.app — Borrow at Near-Treasury Rates",
    description:
      "Calculate box spread borrowing rates and build error-proof orders.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.className} bg-gray-950 text-gray-100 antialiased`}
      >
        <main className="mx-auto max-w-2xl px-4 py-12">{children}</main>
      </body>
    </html>
  );
}
