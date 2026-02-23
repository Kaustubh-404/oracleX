import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { BottomNav } from "@/components/BottomNav";
import { AuthGuard } from "@/components/AuthGuard";

export const metadata: Metadata = {
  title: "OracleX — Prediction Markets",
  description: "AI-powered prediction markets resolved by Chainlink CRE. No manipulation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#efe7f7] text-black min-h-screen">
        <Providers>
          <AuthGuard />
          <div className="max-w-lg mx-auto min-h-screen relative">
            {children}
          </div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
