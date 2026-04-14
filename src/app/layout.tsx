import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
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
    <html lang="en">
      <body
        className={`${inter.className} text-gray-900 antialiased`}
      >
        <nav className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-3 border-b border-gray-300">
          <Link href="/" className="text-sm font-bold tracking-tight text-gray-900">
            boxspreads.app
          </Link>
          <div className="flex gap-5 text-sm font-medium text-gray-500">
            <Link href="/" className="hover:text-gray-900 transition-colors">Calculator</Link>
            <Link href="/learn" className="hover:text-gray-900 transition-colors">Learn</Link>
          </div>
        </nav>
        <main className="mx-auto max-w-screen-2xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
