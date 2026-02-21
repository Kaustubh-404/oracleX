"use client";
import Link from "next/link";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { client, CHAIN } from "@/lib/thirdweb";
import { BuyUSDCButton } from "./BuyUSDCModal";

export function Navbar() {
  const account = useActiveAccount();
  return (
    <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="text-2xl">🔮</span>
          <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            OracleX
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
          <Link href="/" className="hover:text-white transition-colors">Markets</Link>
          <Link href="/create" className="hover:text-white transition-colors">Create</Link>
          <Link href="/portfolio" className="hover:text-white transition-colors">Portfolio</Link>
          <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboard</Link>
        </div>

        {/* Buy USDC — only visible when wallet connected */}
        <div className="flex items-center gap-3">
          {account && (
            <BuyUSDCButton className="hidden sm:block text-xs font-semibold bg-transparent border border-blue-500/50 hover:border-blue-400 text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg transition-colors" />
          )}

        {/* Wallet */}
        <ConnectButton
          client={client}
          chain={CHAIN}
          appMetadata={{
            name: "OracleX",
            description: "AI-powered prediction markets",
          }}
          connectButton={{ label: "Connect Wallet" }}
          detailsButton={{
            displayBalanceToken: { [CHAIN.id]: "0x0" },
          }}
        />
        </div>
      </div>
    </nav>
  );
}
