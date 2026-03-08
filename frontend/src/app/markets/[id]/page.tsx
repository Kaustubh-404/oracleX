"use client";
import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMarket, useOdds, useUserPositions, oracleXContract, worldOracleXContract } from "@/hooks/useMarkets";
import { TradePanel } from "@/components/TradePanel";
import { AdminResolvePanel } from "@/components/AdminResolvePanel";
import { useActiveAccount, useSendTransaction, useReadContract } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { useMarketSocket } from "@/hooks/useSocket";
import { formatUSDC, formatDate, formatTimeLeft, formatConfidence, CATEGORY_META } from "@/lib/utils";
import { isMiniApp } from "@/lib/worldid";
import { getMiniKitAddress } from "@/lib/minikit-wallet";
import { WORLD_ORACLEX_ADDRESS } from "@/lib/worldchain";
import { ORACLE_X_ABI } from "@/abis/OracleX";
import { MiniKit } from "@worldcoin/minikit-js";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { backendFetch } from "@/lib/api";

const OUTCOME_LABEL: Record<number, string> = { 0: "Open", 1: "YES", 2: "NO", 3: "Invalid" };
const OUTCOME_BG: Record<number, string> = {
  0: "bg-[#d3aeff] text-black",
  1: "bg-[#99ff88] text-black",
  2: "bg-[#ff6961] text-white",
  3: "bg-black text-white",
};

/* ── Probability history chart ───────────────────────────────────────────── */
interface ChartPoint { t: string; prob: number; }

function ProbChart({ marketId, chain }: { marketId: string; chain: string }) {
  const [points, setPoints]   = useState<ChartPoint[]>([]);
  const [noTrades, setNoTrades] = useState(false);

  useEffect(() => {
    backendFetch(`/markets/${marketId}/probability-history?chain=${chain}`)
      .then((r) => r.json())
      .then((data: ChartPoint[]) => {
        if (!Array.isArray(data) || data.length === 0) return;
        // Need ≥2 points for an area chart — extend to now if only 1 point
        if (data.length === 1) {
          setNoTrades(true);
          setPoints([...data, { t: new Date().toISOString(), prob: data[0].prob }]);
        } else {
          setPoints(data);
        }
      })
      .catch(() => {});
  }, [marketId, chain]);

  if (points.length < 2) return null;

  const formatted = points.map((p) => ({
    label: new Date(p.t).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    yes: parseFloat((p.prob * 100).toFixed(1)),
    no:  parseFloat(((1 - p.prob) * 100).toFixed(1)),
  }));

  return (
    <div className="retro-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-bold" style={{ fontFamily: "'Brice SemiBold', sans-serif" }}>
          Probability History
        </p>
        {noTrades && (
          <span className="text-xs text-black/40 italic">No trades yet</span>
        )}
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="yesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#99ff88" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#99ff88" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#00000060" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#00000060" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: "3px solid #000",
                borderRadius: "10px",
                fontFamily: "'Brice Regular', sans-serif",
                fontSize: 12,
              }}
              formatter={(v) => [v != null ? `${v}%` : "-", "YES"]}
            />
            <ReferenceLine y={50} stroke="#00000020" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="yes"
              stroke="#2d8a20"
              strokeWidth={3}
              fill="url(#yesGrad)"
              dot={false}
              activeDot={{ r: 5, fill: "#2d8a20", stroke: "#000", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }       = use(params);
  const marketId     = BigInt(id);
  const account      = useActiveAccount();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const chain        = searchParams.get("chain") ?? "sepolia";
  const inWorldApp   = isMiniApp();

  // For World App, use MiniKit address for position reads; for browser use thirdweb account
  const userAddress = inWorldApp ? (getMiniKitAddress() ?? undefined) : account?.address;

  const { data: market, isPending, refetch } = useMarket(marketId, chain);
  const { data: odds }                       = useOdds(marketId, chain);
  const { data: positions }                  = useUserPositions(marketId, userAddress, chain);
  const { mutate: sendTx, isPending: txPending } = useSendTransaction();

  const activeContract = chain === "worldchain" ? worldOracleXContract : oracleXContract;
  const { data: ownerAddress } = useReadContract({ contract: activeContract, method: "owner", params: [] });

  const isOwner = !!(account && ownerAddress &&
    account.address.toLowerCase() === (ownerAddress as string).toLowerCase());

  const [mkPending, setMkPending] = useState(false);
  const [mkError,   setMkError]   = useState<string | null>(null);

  const liveUpdate = useMarketSocket(id);
  useEffect(() => { if (liveUpdate) refetch(); }, [liveUpdate, refetch]);

  useEffect(() => {
    if (inWorldApp) return; // World App users don't have thirdweb accounts
    if (account === undefined) return;
    if (!account) router.replace("/");
  }, [account, router, inWorldApp]);

  if (isPending) {
    return (
      <div className="min-h-screen bg-[#efe7f7] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-black border-t-[#d3aeff] rounded-full animate-spin" />
      </div>
    );
  }
  if (!market) return <p className="p-8 text-black/50">Market not found.</p>;

  const yesPct  = odds ? Number(odds[0]) : 50;
  const noPct   = odds ? Number(odds[1]) : 50;
  const outcome = Number(market.outcome);
  const isOpen  = outcome === 0;
  const cat     = CATEGORY_META[market.category] ?? CATEGORY_META.default;

  const canRequestSettlement =
    isOpen &&
    !market.settlementRequested &&
    BigInt(Math.floor(Date.now() / 1000)) >= market.closingTime;

  const anyTxPending = txPending || mkPending;

  async function handleRequestSettlement() {
    if (inWorldApp && chain === "worldchain") {
      setMkPending(true); setMkError(null);
      try {
        const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
          transaction: [{
            address: WORLD_ORACLEX_ADDRESS,
            abi: ORACLE_X_ABI as unknown as object[],
            functionName: "requestSettlement",
            args: [marketId.toString()],
          }],
        });
        if (finalPayload.status === "success") refetch();
        else setMkError("Transaction rejected");
      } catch (e) { setMkError(e instanceof Error ? e.message : "Transaction failed"); }
      finally { setMkPending(false); }
    } else {
      const tx = prepareContractCall({ contract: activeContract, method: "requestSettlement", params: [marketId] });
      sendTx(tx, { onSuccess: () => refetch() });
    }
  }

  async function handleClaimWinnings() {
    if (inWorldApp && chain === "worldchain") {
      setMkPending(true); setMkError(null);
      try {
        const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
          transaction: [{
            address: WORLD_ORACLEX_ADDRESS,
            abi: ORACLE_X_ABI as unknown as object[],
            functionName: "claimWinnings",
            args: [marketId.toString()],
          }],
        });
        if (finalPayload.status === "success") refetch();
        else setMkError("Transaction rejected");
      } catch (e) { setMkError(e instanceof Error ? e.message : "Transaction failed"); }
      finally { setMkPending(false); }
    } else {
      const tx = prepareContractCall({ contract: activeContract, method: "claimWinnings", params: [marketId] });
      sendTx(tx, { onSuccess: () => refetch() });
    }
  }

  return (
    <div className="min-h-screen bg-[#efe7f7] pb-28" style={{ fontFamily: "'Brice Regular', sans-serif" }}>
      {/* Back */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Link href="/markets" className="w-9 h-9 border-4 border-black rounded-xl bg-white flex items-center justify-center">
          <ArrowLeft size={16} strokeWidth={3} />
        </Link>
        <span className="text-xs text-black/40">Markets / #{id}</span>
      </div>

      <div className="px-4 space-y-4">
        {/* Header */}
        <div className="retro-card p-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-bold capitalize px-2.5 py-1 border-2 border-black rounded-full bg-white">
              {cat.emoji} {market.category}
            </span>
            <span className={`text-xs font-bold px-2.5 py-1 border-2 border-black rounded-full ${OUTCOME_BG[outcome]}`}>
              {isOpen ? formatTimeLeft(market.closingTime) : OUTCOME_LABEL[outcome]}
            </span>
          </div>
          <h1 className="text-xl leading-snug" style={{ fontFamily: "'Brice SemiBold', sans-serif" }}>
            {market.question}
          </h1>
        </div>

        {/* Probability bar */}
        <div className="retro-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-3xl font-bold text-[#2d8a20]" style={{ fontFamily: "'Brice Black', sans-serif" }}>{yesPct}%</span>
              <span className="text-black/40 text-xs ml-1">YES</span>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-[#c0392b]" style={{ fontFamily: "'Brice Black', sans-serif" }}>{noPct}%</span>
              <span className="text-black/40 text-xs ml-1">NO</span>
            </div>
          </div>
          <div className="h-4 border-4 border-black rounded-full overflow-hidden bg-[#ff6961]">
            <div className="h-full bg-[#99ff88] rounded-full transition-all" style={{ width: `${yesPct}%` }} />
          </div>
        </div>

        {/* Probability history chart */}
        <ProbChart marketId={id} chain={chain} />

        {/* AI Resolution result */}
        {!isOpen && market.aiConfidenceBps > 0n && (
          <div className="retro-card p-4">
            <p className="font-bold mb-2">🤖 AI Resolution</p>
            <div className="flex items-center justify-between mb-2">
              <span className={`font-bold text-lg px-3 py-1 rounded-xl border-4 border-black ${OUTCOME_BG[outcome]}`}>
                {OUTCOME_LABEL[outcome]}
              </span>
              <span className="text-sm text-black/50">{formatConfidence(market.aiConfidenceBps)} confidence</span>
            </div>
            <div className="h-2.5 border-2 border-black rounded-full overflow-hidden bg-black/10">
              <div className="h-full bg-[#d3aeff] rounded-full" style={{ width: `${(Number(market.aiConfidenceBps) / 100).toFixed(1)}%` }} />
            </div>
            <p className="text-xs text-black/40 mt-2">Resolved by Chainlink CRE + Llama 3.3 70B</p>
          </div>
        )}

        {/* Market stats */}
        <div className="retro-card p-4">
          <p className="font-bold mb-3">Market Details</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-black/40 mb-0.5">Total Volume</p>
              <p className="font-bold">{formatUSDC(market.yesPool + market.noPool)}</p>
            </div>
            <div>
              <p className="text-xs text-black/40 mb-0.5">Closes</p>
              <p className="font-bold text-xs">{formatDate(market.closingTime)}</p>
            </div>
            <div>
              <p className="text-xs text-black/40 mb-0.5">Resolution Source</p>
              <p className="font-bold text-xs truncate">{market.resolutionSource || "AI + Chainlink CRE"}</p>
            </div>
            <div>
              <p className="text-xs text-black/40 mb-0.5">Oracle</p>
              <p className="font-bold text-xs text-[#6d28d9]">Chainlink CRE + AI</p>
            </div>
          </div>
        </div>

        {/* Request settlement */}
        {canRequestSettlement && (
          <div className="border-4 border-black rounded-2xl p-4 bg-[#ffe066]">
            <p className="text-sm font-bold mb-1">⏰ Market has closed</p>
            <p className="text-xs text-black/60 mb-3">Trigger AI resolution via Chainlink CRE</p>
            <button
              onClick={handleRequestSettlement}
              disabled={anyTxPending}
              className="retro-btn w-full bg-black text-white py-3 text-sm"
            >
              {anyTxPending ? "Requesting…" : "Request AI Settlement →"}
            </button>
          </div>
        )}

        {/* Admin resolve panel */}
        {isOwner && isOpen && market.settlementRequested && (
          <AdminResolvePanel
            marketId={marketId}
            question={market.question}
            category={market.category}
            resolutionSource={market.resolutionSource}
            onSettled={() => refetch()}
          />
        )}

        {/* Trade or Claim */}
        {isOpen ? (
          <TradePanel marketId={marketId} yesPct={yesPct} noPct={noPct} chain={chain} onSuccess={() => refetch()} />
        ) : (
          positions && (positions[0] > 0n || positions[1] > 0n) && (
            <div className="retro-card p-4">
              <p className="font-bold mb-3">Your Position</p>
              <div className="flex gap-2 mb-4">
                {positions[0] > 0n && (
                  <div className="flex-1 bg-[#99ff88] border-4 border-black rounded-2xl px-3 py-2 text-center">
                    <p className="text-xs font-bold text-black/60">YES</p>
                    <p className="font-bold" style={{ fontFamily: "'Brice Black', sans-serif" }}>{formatUSDC(positions[0])}</p>
                  </div>
                )}
                {positions[1] > 0n && (
                  <div className="flex-1 bg-[#ff6961] border-4 border-black rounded-2xl px-3 py-2 text-center">
                    <p className="text-xs font-bold text-white/70">NO</p>
                    <p className="font-bold text-white" style={{ fontFamily: "'Brice Black', sans-serif" }}>{formatUSDC(positions[1])}</p>
                  </div>
                )}
              </div>
              <button
                onClick={handleClaimWinnings}
                disabled={anyTxPending}
                className="retro-btn w-full bg-black text-white py-3 text-sm"
              >
                {anyTxPending ? "Claiming…" : "Claim Winnings 🎉"}
              </button>
            </div>
          )
        )}

        {mkError && (
          <p className="text-xs text-[#ff6961] text-center mt-2">{mkError}</p>
        )}
      </div>
    </div>
  );
}
