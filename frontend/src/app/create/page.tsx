"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { prepareContractCall, getContract, readContract, sendAndConfirmTransaction } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { isMiniApp, isVerifiedForCreate, verifyForCreate } from "@/lib/worldid";
import { client, CHAIN, ORACLEX_ADDRESS, USDC_ADDRESS } from "@/lib/thirdweb";
import { WORLD_ORACLEX_ADDRESS, WORLD_USDC_ADDRESS } from "@/lib/worldchain";
import { ORACLE_X_ABI, USDC_ABI } from "@/abis/OracleX";
import { parseUSDC } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { backendFetch } from "@/lib/api";
import { MiniKit } from "@worldcoin/minikit-js";
const oracleXContract = getContract({ client, chain: CHAIN, address: ORACLEX_ADDRESS, abi: ORACLE_X_ABI });
const usdcContract    = getContract({ client, chain: CHAIN, address: USDC_ADDRESS,   abi: USDC_ABI    });
// Decimal representation for MiniKit args (hex may not be parsed correctly)
const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

const CATEGORIES = ["crypto", "sports", "tech", "news"] as const;
type Category = typeof CATEGORIES[number];

const CAT_EMOJI: Record<Category, string> = { crypto: "🪙", sports: "⚽", tech: "💻", news: "📰" };
const CAT_EXAMPLES: Record<Category, string[]> = {
  crypto: ["Will ETH exceed $5,000 before March 31, 2026?", "Will BTC reach a new ATH in Q1 2026?"],
  sports: ["Will the Kansas City Chiefs win Super Bowl LX?", "Will Messi score 20+ goals in 2025-26?"],
  tech:   ["Will OpenAI release GPT-5 before July 2026?", "Will Apple release a foldable iPhone in 2026?"],
  news:   ["Will the Fed cut rates at least twice in 2026?", "Will global inflation drop below 3%?"],
};
const CAT_SOURCE: Record<Category, string> = {
  crypto: "CoinGecko API + Chainlink Price Feeds",
  sports: "The Odds API + ESPN",
  tech:   "NewsAPI + official announcements",
  news:   "Reuters + AP News via NewsAPI",
};
const DURATIONS = [
  { label: "1 h",  seconds: 3600    }, { label: "6 h",    seconds: 21600   },
  { label: "1 d",  seconds: 86400   }, { label: "3 d",    seconds: 259200  },
  { label: "1 wk", seconds: 604800  }, { label: "2 wk",   seconds: 1209600 },
  { label: "1 mo", seconds: 2592000 },
];

interface AiSuggestion { resolutionSource: string; resolutionCriteria: string; suggestedDuration: number; }

export default function CreatePage() {
  const router  = useRouter();
  const account = useActiveAccount();
  const inWorldApp = isMiniApp();
  const [isPending, setIsPending] = useState(false);
  const [txError,   setTxError]  = useState<string | null>(null);

  const [category,    setCategory]    = useState<Category>("crypto");
  const [question,    setQuestion]    = useState("");
  const [durationSec, setDuration]    = useState(86400);
  const [liquidityStr, setLiquidity]  = useState("100");
  const [step, setStep]               = useState<"form" | "confirm" | "done">("form");
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiSuggestion, setAiSugg]     = useState<AiSuggestion | null>(null);
  const [aiError,     setAiError]     = useState<string | null>(null);
  const [resolutionSource, setResSrc] = useState("");

  useEffect(() => {
    if (inWorldApp) return; // World App users browse without thirdweb account
    if (account === undefined) return;
    if (!account) router.replace("/");
  }, [account, router, inWorldApp]);

  const liquidity   = parseUSDC(liquidityStr);
  const closingTime = BigInt(Math.floor(Date.now() / 1000) + durationSec);
  const isValid     = question.trim().length >= 10 && liquidity > 0n;

  async function handleAiGenerate() {
    if (!question.trim()) return;
    setAiLoading(true); setAiError(null);
    try {
      const r = await backendFetch("/ai/generate-market", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, question: question.trim() }),
      });
      if (!r.ok) throw new Error("AI service unavailable");
      const data = await r.json() as AiSuggestion;
      setAiSugg(data); setResSrc(data.resolutionSource);
      const secs = data.suggestedDuration * 86400;
      const closest = DURATIONS.reduce((p, c) => Math.abs(c.seconds - secs) < Math.abs(p.seconds - secs) ? c : p);
      setDuration(closest.seconds);
    } catch (e) { setAiError(e instanceof Error ? e.message : "Failed"); }
    finally { setAiLoading(false); }
  }

  async function handleCreate() {
    if (!account || !isValid || isPending) return;
    setTxError(null);

    // World ID gate — only inside World App
    if (isMiniApp() && !isVerifiedForCreate()) {
      setIsPending(true);
      try { await verifyForCreate(); }
      catch (e) { setTxError(e instanceof Error ? e.message : "World ID verification failed"); setIsPending(false); return; }
      setIsPending(false);
    }

    setStep("confirm");
    setIsPending(true);

    try {
      // Check existing allowance — skip approve if already sufficient
      const allowance = await readContract({
        contract: usdcContract,
        method:   "allowance",
        params:   [account.address as `0x${string}`, ORACLEX_ADDRESS as `0x${string}`],
      });

      if ((allowance as bigint) < liquidity) {
        await sendAndConfirmTransaction({
          transaction: prepareContractCall({
            contract: usdcContract,
            method:   "approve",
            params:   [ORACLEX_ADDRESS, liquidity],
          }),
          account,
        });
      }

      const resolSource = resolutionSource || CAT_SOURCE[category];
      await sendAndConfirmTransaction({
        transaction: prepareContractCall({
          contract: oracleXContract,
          method:   "createMarket",
          params:   [question.trim(), category, resolSource, closingTime, closingTime + BigInt(7 * 86400), USDC_ADDRESS as `0x${string}`, liquidity],
        }),
        account,
      });

      setStep("done");
    } catch (e) {
      setStep("form");
      setTxError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setIsPending(false);
    }
  }

  if (step === "done") {
    return (
      <div className="min-h-screen bg-[#efe7f7] flex flex-col items-center justify-center px-6 pb-28" style={{ fontFamily: "'Brice Regular', sans-serif" }}>
        <div className="retro-card p-8 text-center max-w-sm w-full">
          <p className="text-6xl mb-4">🎉</p>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Brice Black', sans-serif" }}>Market Created!</h2>
          <p className="text-sm text-black/60 mb-6">Your prediction market is live on-chain.</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => router.push("/markets")} className="retro-btn bg-black text-white py-3 w-full">View Markets →</button>
            <button onClick={() => { setStep("form"); setQuestion(""); setAiSugg(null); }} className="retro-btn bg-white py-3 w-full">Create Another</button>
          </div>
        </div>
      </div>
    );
  }

  async function handleWorldChainCreate() {
    if (!isValid || isPending) return;
    setTxError(null);

    // World ID gate
    if (!isVerifiedForCreate()) {
      setIsPending(true);
      try { await verifyForCreate(); }
      catch (e) { setTxError(e instanceof Error ? e.message : "World ID verification failed"); setIsPending(false); return; }
      setIsPending(false);
    }

    setStep("confirm");
    setIsPending(true);
    try {
      // Step 1: Approve USDC spending
      const approveResult = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: WORLD_USDC_ADDRESS,
            abi: USDC_ABI as unknown as object[],
            functionName: "approve",
            args: [WORLD_ORACLEX_ADDRESS, MAX_UINT256],
          },
        ],
      });
      if (approveResult.finalPayload.status !== "success") {
        setStep("form");
        setTxError("Approval rejected");
        setIsPending(false);
        return;
      }

      // Step 2: Create market (separate tx so approve is confirmed first)
      const resolSource = resolutionSource || CAT_SOURCE[category];
      const ct = closingTime.toString();
      const sd = (closingTime + BigInt(7 * 86400)).toString();
      const liq = liquidity.toString();

      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: WORLD_ORACLEX_ADDRESS,
            abi: ORACLE_X_ABI as unknown as object[],
            functionName: "createMarket",
            args: [question.trim(), category, resolSource, ct, sd, WORLD_USDC_ADDRESS, liq],
          },
        ],
      });
      if (finalPayload.status === "success") {
        setStep("done");
      } else {
        setStep("form");
        setTxError("Transaction rejected");
      }
    } catch (e) {
      setStep("form");
      setTxError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#efe7f7] pb-28 px-4" style={{ fontFamily: "'Brice Regular', sans-serif" }}>
      <div className="pt-5 pb-4">
        <h1 className="text-3xl" style={{ fontFamily: "'Brice Black', sans-serif" }}>Create Market</h1>
        <p className="text-sm text-black/50 mt-1">Ask a yes/no question · AI resolves it · Anyone can bet</p>
      </div>

      <div className="space-y-4 max-w-lg">
        {/* Step 1 — Category */}
        <div className="retro-card p-4">
          <p className="font-bold mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-black text-white text-xs rounded-full flex items-center justify-center font-brice-black">1</span>
            Category
          </p>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => { setCategory(c); setQuestion(""); setAiSugg(null); }}
                className={`retro-btn py-2 text-sm capitalize ${category === c ? "bg-black text-white" : "bg-white text-black"}`}
                style={{ borderWidth: "3px" }}
              >
                {CAT_EMOJI[c]} {c}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2 — Question */}
        <div className="retro-card p-4">
          <p className="font-bold mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-black text-white text-xs rounded-full flex items-center justify-center">2</span>
            Question
          </p>
          <textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will Bitcoin exceed $100k by end of 2026?"
            className="w-full border-4 border-black rounded-xl px-4 py-3 text-sm placeholder-black/30 focus:outline-none bg-white resize-none"
          />
          {question.trim().length >= 10 && (
            <button
              onClick={handleAiGenerate}
              disabled={aiLoading}
              className="retro-btn mt-2 bg-[#d3aeff] text-black px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
              style={{ borderWidth: "3px" }}
            >
              <Sparkles size={14} />
              {aiLoading ? "Generating…" : "Auto-fill with AI"}
            </button>
          )}
          {aiError && <p className="text-xs text-[#ff6961] mt-1">{aiError}</p>}
          {aiSuggestion && (
            <div className="mt-3 border-4 border-[#d3aeff] rounded-xl p-3 bg-[#d3aeff]/20 text-sm space-y-1">
              <p className="font-bold text-xs">AI Suggestion</p>
              <p><span className="text-black/50">Source:</span> {aiSuggestion.resolutionSource}</p>
              <p><span className="text-black/50">Resolves YES if:</span> {aiSuggestion.resolutionCriteria}</p>
            </div>
          )}
          <p className="text-xs text-black/40 mt-3 mb-2">Examples:</p>
          <div className="space-y-1.5">
            {CAT_EXAMPLES[category].map((ex) => (
              <button key={ex} onClick={() => { setQuestion(ex); setAiSugg(null); }}
                className="w-full text-left text-xs px-3 py-2 border-2 border-black/20 rounded-xl bg-white/60 hover:bg-white transition-colors">
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Step 3 — Duration */}
        <div className="retro-card p-4">
          <p className="font-bold mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-black text-white text-xs rounded-full flex items-center justify-center">3</span>
            Duration
          </p>
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((d) => (
              <button key={d.seconds} onClick={() => setDuration(d.seconds)}
                className={`retro-btn py-2 text-xs ${durationSec === d.seconds ? "bg-black text-white" : "bg-white text-black"}`}
                style={{ borderWidth: "3px" }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 4 — Liquidity */}
        <div className="retro-card p-4">
          <p className="font-bold mb-1 flex items-center gap-2">
            <span className="w-6 h-6 bg-black text-white text-xs rounded-full flex items-center justify-center">4</span>
            Initial Liquidity
          </p>
          <p className="text-xs text-black/40 mb-3 ml-8">Split 50/50 into YES/NO pools. You get it back + winnings.</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold">$</span>
            <input
              type="number" min="10" value={liquidityStr} onChange={(e) => setLiquidity(e.target.value)}
              className="w-full border-4 border-black rounded-xl pl-8 pr-4 py-2.5 bg-white focus:outline-none"
            />
          </div>
          <div className="flex gap-2 mt-2">
            {["50", "100", "250", "500"].map((v) => (
              <button key={v} onClick={() => setLiquidity(v)}
                className="flex-1 text-xs py-2 border-2 border-black rounded-lg bg-white hover:bg-black hover:text-white transition-colors">
                ${v}
              </button>
            ))}
          </div>
        </div>

        {/* Resolution info */}
        <div className="border-4 border-[#d3aeff] rounded-2xl p-4 bg-[#d3aeff]/20 text-sm">
          <p className="font-bold mb-1">How resolution works</p>
          <p className="text-xs text-black/60">
            When the market closes, Chainlink CRE triggers AI to read {CAT_SOURCE[category]} and
            report the outcome on-chain with a confidence score. Below 80% → INVALID, everyone refunded.
          </p>
        </div>

        {/* Submit */}
        {inWorldApp ? (
          <>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#d3aeff]/20 border-2 border-[#d3aeff] rounded-xl">
              <span className="text-xs font-bold">🌐 Creating on World Chain Sepolia</span>
            </div>
            <button
              onClick={handleWorldChainCreate}
              disabled={!isValid || isPending}
              className="retro-btn w-full bg-black text-white py-4 text-base"
            >
              {isPending ? "Processing…" : `Create Market · Seed $${liquidityStr}`}
            </button>
          </>
        ) : account ? (
          <button
            onClick={handleCreate}
            disabled={!isValid || isPending}
            className="retro-btn w-full bg-black text-white py-4 text-base"
          >
            {isPending ? "Processing…" : `Create Market · Seed $${liquidityStr}`}
          </button>
        ) : (
          <div className="retro-card p-4 text-center text-sm text-black/50">
            Connect your wallet to create a market
          </div>
        )}
        {txError && <p className="text-xs text-[#ff6961] text-center">{txError}</p>}
      </div>
    </div>
  );
}
