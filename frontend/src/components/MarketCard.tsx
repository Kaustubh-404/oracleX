"use client";
import Link from "next/link";
import { useMarket, useOdds } from "@/hooks/useMarkets";
import {
  formatUSDC,
  formatTimeLeft,
  CATEGORY_META,
  OUTCOME_LABEL,
  OUTCOME_COLOR,
} from "@/lib/utils";

interface Props {
  marketId: bigint;
}

export function MarketCard({ marketId }: Props) {
  const { data: market, isPending } = useMarket(marketId);
  const { data: odds } = useOdds(marketId);

  if (isPending || !market) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 animate-pulse h-44" />
    );
  }

  const yesPct = odds ? Number(odds[0]) : 50;
  const noPct  = odds ? Number(odds[1]) : 50;
  const totalPool = market.yesPool + market.noPool;
  const outcome   = Number(market.outcome);
  const isOpen    = outcome === 0;
  const category  = CATEGORY_META[market.category] ?? CATEGORY_META.default;

  return (
    <Link href={`/markets/${marketId}`}>
      <div className="rounded-xl border border-gray-800 bg-gray-900 hover:border-gray-600 hover:bg-gray-800/80 transition-all p-5 cursor-pointer group">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${category.color}`}>
            {category.emoji} {market.category}
          </span>
          <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
            {isOpen ? (
              <span className="text-green-400">{formatTimeLeft(market.closingTime)}</span>
            ) : (
              <span className={OUTCOME_COLOR[outcome]}>
                {OUTCOME_LABEL[outcome]}
              </span>
            )}
          </div>
        </div>

        {/* Question */}
        <p className="font-medium text-gray-100 text-sm leading-snug mb-4 line-clamp-2 group-hover:text-white">
          {market.question}
        </p>

        {/* Probability bar */}
        {isOpen && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-green-400 font-semibold">YES {yesPct}%</span>
              <span className="text-red-400 font-semibold">NO {noPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                style={{ width: `${yesPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{formatUSDC(totalPool)} volume</span>
          {isOpen && (
            <div className="flex gap-2">
              <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                ${(yesPct / 100).toFixed(2)} YES
              </span>
              <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                ${(noPct / 100).toFixed(2)} NO
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
