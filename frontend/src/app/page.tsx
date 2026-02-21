"use client";
import { useActiveMarkets } from "@/hooks/useMarkets";
import { MarketCard } from "@/components/MarketCard";
import Link from "next/link";

export default function HomePage() {
  const { data: activeIds, isPending } = useActiveMarkets();

  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-12 pt-4">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-sm text-blue-400 mb-4">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          Powered by Chainlink CRE · No governance tokens
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Prediction Markets
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            That Don&apos;t Lie
          </span>
        </h1>
        <p className="text-gray-400 max-w-xl mx-auto mb-8">
          AI-powered resolution via Chainlink CRE. Every settlement is verifiable,
          multi-source, and manipulation-proof.
        </p>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          + Create Market
        </Link>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Active Markets", value: isPending ? "..." : String(activeIds?.length ?? 0) },
          { label: "Oracle Type",    value: "Chainlink CRE" },
          { label: "Resolution AI",  value: "Llama 3.3 70B" },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className="text-xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Markets grid */}
      {isPending ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-gray-800 bg-gray-900 h-44 animate-pulse" />
          ))}
        </div>
      ) : !activeIds || activeIds.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-5xl mb-4">🔮</p>
          <p className="text-lg font-medium text-gray-400">No active markets yet</p>
          <p className="text-sm mt-1">
            <Link href="/create" className="text-blue-400 hover:underline">
              Create the first one
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeIds.map((id) => (
            <MarketCard key={id.toString()} marketId={id} />
          ))}
        </div>
      )}
    </div>
  );
}
