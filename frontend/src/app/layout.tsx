import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OracleX — Prediction Markets That Don't Lie",
  description:
    "AI-powered prediction markets resolved by Chainlink CRE. No governance tokens. No manipulation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>
        <Providers>
          <Navbar />
          <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
          <footer className="border-t border-gray-800 mt-16 py-8 text-center text-gray-500 text-sm">
            Built with Chainlink CRE + AI · Convergence Hackathon 2026
          </footer>
        </Providers>
      </body>
    </html>
  );
}
