"use client";
import { use, useEffect } from "react";
import { useMarket, useOdds, useUserPositions, oracleXContract } from "@/hooks/useMarkets";
import { TradePanel } from "@/components/TradePanel";
import { ProbabilityChart } from "@/components/ProbabilityChart";
import { AdminResolvePanel } from "@/components/AdminResolvePanel";
import { useActiveAccount, useSendTransaction, useReadContract } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { useMarketSocket } from "@/hooks/useSocket";
import {
  formatUSDC, formatDate, formatTimeLeft, formatConfidence,
  CATEGORY_META, OUTCOME_LABEL, OUTCOME_COLOR,
} from "@/lib/utils";

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const marketId = BigInt(id);

  const { data: market, isPending, refetch } = useMarket(marketId);
  const { data: odds }                       = useOdds(marketId);
  const account                              = useActiveAccount();
  const { data: positions }                  = useUserPositions(marketId, account?.address);
  const { mutate: sendTx, isPending: txPending } = useSendTransaction();
  const { data: ownerAddress }               = useReadContract({ contract: oracleXContract, method: "owner", params: [] });

  const isOwner = !!(account && ownerAddress && account.address.toLowerCase() === (ownerAddress as string).toLowerCase());

  // Live updates via WebSocket — auto-refetch on any trade/settlement event
  const liveUpdate = useMarketSocket(id);
  useEffect(() => {
    if (liveUpdate) refetch();
  }, [liveUpdate, refetch]);

  if (isPending) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-800 rounded w-3/4" />
        <div className="h-64 bg-gray-800 rounded" />
      </div>
    );
  }

  if (!market) return <p className="text-gray-500">Market not found.</p>;

  const yesPct   = odds ? Number(odds[0]) : 50;
  const noPct    = odds ? Number(odds[1]) : 50;
  const outcome  = Number(market.outcome);
  const isOpen   = outcome === 0;
  const category = CATEGORY_META[market.category] ?? CATEGORY_META.default;

  const canRequestSettlement =
    isOpen &&
    !market.settlementRequested &&
    BigInt(Math.floor(Date.now() / 1000)) >= market.closingTime;

  function handleRequestSettlement() {
    const tx = prepareContractCall({
      contract: oracleXContract,
      method:   "requestSettlement",
      params:   [marketId],
    });
    sendTx(tx, { onSuccess: () => refetch() });
  }

  function handleClaimWinnings() {
    const tx = prepareContractCall({
      contract: oracleXContract,
      method:   "claimWinnings",
      params:   [marketId],
    });
    sendTx(tx, { onSuccess: () => refetch() });
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <p className="text-sm text-gray-500 mb-4">
        <a href="/" className="hover:text-gray-300">Markets</a> / #{id}
      </p>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${category.color}`}>
            {category.emoji} {market.category}
          </span>
          <span className={`text-sm font-medium ${OUTCOME_COLOR[outcome]}`}>
            {isOpen ? formatTimeLeft(market.closingTime) : OUTCOME_LABEL[outcome]}
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white leading-snug">
          {market.question}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: chart + stats */}
        <div className="lg:col-span-2 space-y-4">
          {/* Probability chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-3xl font-bold text-green-400">{yesPct}%</span>
                <span className="text-gray-500 ml-2 text-sm">chance YES</span>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold text-red-400">{noPct}%</span>
                <span className="text-gray-500 ml-2 text-sm">chance NO</span>
              </div>
            </div>
            {/* Probability bar */}
            <div className="h-3 rounded-full bg-gray-700 overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                style={{ width: `${yesPct}%` }}
              />
            </div>
            {/* Chart placeholder */}
            <ProbabilityChart marketId={marketId} />
          </div>

          {/* Market info */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3 text-sm">
            <h3 className="font-semibold text-gray-200">Market Details</h3>
            <div className="grid grid-cols-2 gap-3 text-gray-400">
              <div>
                <p className="text-xs text-gray-600 mb-0.5">Total Volume</p>
                <p className="text-white font-medium">
                  {formatUSDC(market.yesPool + market.noPool)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-0.5">Closes</p>
                <p className="text-white font-medium">{formatDate(market.closingTime)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-0.5">Resolution Source</p>
                <p className="text-white font-medium">{market.resolutionSource}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-0.5">Oracle</p>
                <p className="text-blue-400 font-medium">Chainlink CRE + AI</p>
              </div>
            </div>
          </div>

          {/* AI resolution details (if settled) */}
          {!isOpen && market.aiConfidenceBps > 0n && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold text-gray-200 mb-3">AI Resolution</h3>
              <div className="flex items-center gap-2 mb-2">
                <span className={`font-bold text-lg ${OUTCOME_COLOR[outcome]}`}>
                  {OUTCOME_LABEL[outcome]}
                </span>
                <span className="text-xs text-gray-500">
                  · {formatConfidence(market.aiConfidenceBps)} confidence
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Resolved by Chainlink CRE + Llama 3.3 70B
              </div>
            </div>
          )}

          {/* Request settlement button */}
          {canRequestSettlement && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-sm text-yellow-300 mb-3">
                This market has closed. Trigger Chainlink CRE to resolve it.
              </p>
              <button
                onClick={handleRequestSettlement}
                disabled={txPending}
                className="bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {txPending ? "Requesting..." : "Request AI Settlement →"}
              </button>
            </div>
          )}

          {/* Admin resolve panel — owner only, after settlement is requested */}
          {isOwner && isOpen && market.settlementRequested && (
            <AdminResolvePanel
              marketId={marketId}
              question={market.question}
              category={market.category}
              resolutionSource={market.resolutionSource}
              onSettled={() => refetch()}
            />
          )}
        </div>

        {/* Right: trade panel or claim */}
        <div className="space-y-4">
          {isOpen ? (
            <TradePanel
              marketId={marketId}
              yesPct={yesPct}
              noPct={noPct}
              onSuccess={() => refetch()}
            />
          ) : (
            positions && (positions[0] > 0n || positions[1] > 0n) && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold text-gray-200 mb-3">Your Position</h3>
                <div className="space-y-2 text-sm text-gray-400 mb-4">
                  {positions[0] > 0n && (
                    <div className="flex justify-between">
                      <span>YES</span>
                      <span className="text-white">{formatUSDC(positions[0])}</span>
                    </div>
                  )}
                  {positions[1] > 0n && (
                    <div className="flex justify-between">
                      <span>NO</span>
                      <span className="text-white">{formatUSDC(positions[1])}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleClaimWinnings}
                  disabled={txPending}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-sm disabled:opacity-50"
                >
                  {txPending ? "Claiming..." : "Claim Winnings"}
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
