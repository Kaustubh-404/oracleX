"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { prepareContractCall, getContract } from "thirdweb";
import { useSendTransaction, useActiveAccount } from "thirdweb/react";
import { client, CHAIN, ORACLEX_ADDRESS, USDC_ADDRESS } from "@/lib/thirdweb";
import { ORACLE_X_ABI, USDC_ABI } from "@/abis/OracleX";
import { parseUSDC } from "@/lib/utils";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

const oracleXContract = getContract({ client, chain: CHAIN, address: ORACLEX_ADDRESS, abi: ORACLE_X_ABI });
const usdcContract    = getContract({ client, chain: CHAIN, address: USDC_ADDRESS, abi: USDC_ABI });

const CATEGORIES = ["crypto", "sports", "tech", "news"] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_EXAMPLES: Record<Category, string[]> = {
  crypto: [
    "Will ETH exceed $5,000 before March 31, 2026?",
    "Will BTC reach a new all-time high in Q1 2026?",
    "Will SOL flip ETH in market cap by end of 2026?",
  ],
  sports: [
    "Will the Kansas City Chiefs win Super Bowl LX?",
    "Will Lionel Messi score 20+ goals in the 2025-26 MLS season?",
    "Will the Golden State Warriors make the 2026 NBA playoffs?",
  ],
  tech: [
    "Will OpenAI release GPT-5 before July 2026?",
    "Will Apple release a foldable iPhone in 2026?",
    "Will Google's Gemini surpass ChatGPT in monthly users by mid-2026?",
  ],
  news: [
    "Will the US Federal Reserve cut rates at least twice in 2026?",
    "Will global inflation drop below 3% by end of 2026?",
    "Will a G7 country elect a new head of government in 2026?",
  ],
};

const RESOLUTION_SOURCES: Record<Category, string> = {
  crypto: "CoinGecko API + Chainlink Price Feeds",
  sports: "The Odds API + ESPN",
  tech:   "NewsAPI + official announcements",
  news:   "Reuters + AP News via NewsAPI",
};

const DURATIONS = [
  { label: "1 hour",  seconds: 3600          },
  { label: "6 hours", seconds: 21600         },
  { label: "1 day",   seconds: 86400         },
  { label: "3 days",  seconds: 259200        },
  { label: "1 week",  seconds: 604800        },
  { label: "2 weeks", seconds: 1209600       },
  { label: "1 month", seconds: 2592000       },
];

interface AiSuggestion {
  resolutionSource:   string;
  resolutionCriteria: string;
  suggestedDuration:  number;
}

export default function CreatePage() {
  const router  = useRouter();
  const account = useActiveAccount();
  const { mutate: sendTx, isPending, error } = useSendTransaction();

  const [category,   setCategory]   = useState<Category>("crypto");
  const [question,   setQuestion]   = useState("");
  const [durationSec, setDuration]  = useState(86400);
  const [liquidityStr, setLiquidity] = useState("100");
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");

  // AI generation state
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiError, setAiError]           = useState<string | null>(null);
  const [resolutionSource, setResolutionSource] = useState("");

  const liquidity   = parseUSDC(liquidityStr);
  const closingTime = BigInt(Math.floor(Date.now() / 1000) + durationSec);
  const isValid     = question.trim().length >= 10 && liquidity > 0n;

  function handleExampleClick(q: string) {
    setQuestion(q);
    setAiSuggestion(null);
  }

  async function handleAiGenerate() {
    if (!question.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const resp = await fetch(`${BACKEND_URL}/ai/generate-market`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ category, question: question.trim() }),
      });
      if (!resp.ok) throw new Error("AI service unavailable");
      const data = await resp.json() as AiSuggestion;
      setAiSuggestion(data);
      setResolutionSource(data.resolutionSource);
      // Apply suggested duration
      const secs = data.suggestedDuration * 86400;
      const closest = DURATIONS.reduce((prev, cur) =>
        Math.abs(cur.seconds - secs) < Math.abs(prev.seconds - secs) ? cur : prev
      );
      setDuration(closest.seconds);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  function handleCreate() {
    if (!account || !isValid) return;
    setStep("confirm");

    const resolSource = resolutionSource || RESOLUTION_SOURCES[category];

    // 1) Approve USDC
    const approveTx = prepareContractCall({
      contract: usdcContract,
      method:   "approve",
      params:   [ORACLEX_ADDRESS, liquidity],
    });

    sendTx(approveTx, {
      onSuccess: () => {
        // 2) createMarket — ABI param order:
        //   question, category, resolutionSource,
        //   closingTime, settlementDeadline, collateralToken, initialLiquidity
        const createTx = prepareContractCall({
          contract: oracleXContract,
          method:   "createMarket",
          params:   [
            question.trim(),
            category,
            resolSource,
            closingTime,
            closingTime + BigInt(7 * 86400), // settlementDeadline
            USDC_ADDRESS as `0x${string}`,
            liquidity,
          ],
        });

        sendTx(createTx, {
          onSuccess: () => {
            setStep("done");
          },
        });
      },
    });
  }

  if (step === "done") {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-white mb-2">Market Created!</h2>
        <p className="text-gray-400 mb-6">
          Your prediction market is live on-chain. Share it and start trading.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push("/")}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-lg"
          >
            View Markets →
          </button>
          <button
            onClick={() => { setStep("form"); setQuestion(""); }}
            className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-5 py-2.5 rounded-lg"
          >
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Create a Market</h1>
        <p className="text-gray-400">
          Anyone can create a market. AI resolution via Chainlink CRE is automatic.
        </p>
      </div>

      <div className="space-y-6">
        {/* Step 1 — Category */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">1</span>
            Category
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => { setCategory(c); setQuestion(""); }}
                className={`py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                  category === c
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                {c === "crypto" ? "🪙" : c === "sports" ? "⚽" : c === "tech" ? "💻" : "📰"} {c}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2 — Question */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">2</span>
            Question
          </h2>

          <textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a clear yes/no question..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none mb-3"
          />

          {/* AI Generate button */}
          {question.trim().length >= 10 && (
            <div className="mb-3">
              <button
                onClick={handleAiGenerate}
                disabled={aiLoading}
                className="text-xs bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {aiLoading ? "Generating…" : "✨ Auto-fill with AI"}
              </button>
              {aiError && <p className="mt-1 text-xs text-red-400">{aiError}</p>}
            </div>
          )}

          {/* AI suggestion display */}
          {aiSuggestion && (
            <div className="mb-3 bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-xs text-gray-300 space-y-1">
              <p className="text-purple-300 font-medium">AI Suggestion</p>
              <p><span className="text-gray-500">Source:</span> {aiSuggestion.resolutionSource}</p>
              <p><span className="text-gray-500">Resolves YES if:</span> {aiSuggestion.resolutionCriteria}</p>
              <p><span className="text-gray-500">Suggested duration:</span> {aiSuggestion.suggestedDuration} days</p>
            </div>
          )}

          <p className="text-xs text-gray-500 mb-2">Examples:</p>
          <div className="space-y-1.5">
            {CATEGORY_EXAMPLES[category].map((ex) => (
              <button
                key={ex}
                onClick={() => handleExampleClick(ex)}
                className="w-full text-left text-xs text-gray-400 hover:text-white px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Step 3 — Duration */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">3</span>
            Market Duration
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.seconds}
                onClick={() => setDuration(d.seconds)}
                className={`py-2 rounded-lg text-xs font-medium transition-all ${
                  durationSec === d.seconds
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 4 — Initial Liquidity */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-gray-200 mb-1 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">4</span>
            Initial Liquidity
          </h2>
          <p className="text-xs text-gray-500 mb-3 ml-7">
            Split 50/50 into YES and NO pools. You get this back (+ winnings) when it resolves.
          </p>
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              type="number"
              min="10"
              value={liquidityStr}
              onChange={(e) => setLiquidity(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2 mt-2 max-w-xs">
            {["50", "100", "250", "500"].map((v) => (
              <button
                key={v}
                onClick={() => setLiquidity(v)}
                className="flex-1 text-xs py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
              >
                ${v}
              </button>
            ))}
          </div>
        </div>

        {/* Resolution info */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm text-gray-400">
          <div className="flex items-start gap-3">
            <span className="text-blue-400 mt-0.5">ℹ</span>
            <div>
              <p className="text-blue-300 font-medium mb-1">How resolution works</p>
              <p>
                When this market closes, anyone can trigger Chainlink CRE to resolve it.
                AI reads <span className="text-white">{RESOLUTION_SOURCES[category]}</span>{" "}
                and reports the outcome on-chain with a confidence score.
                A confidence below 80% results in <span className="text-yellow-400">INVALID</span> — everyone gets refunded.
              </p>
            </div>
          </div>
        </div>

        {/* Submit */}
        {account ? (
          <button
            onClick={handleCreate}
            disabled={!isValid || isPending}
            className="w-full py-3.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all text-sm"
          >
            {isPending
              ? step === "confirm"
                ? "Creating market…"
                : "Approving USDC…"
              : `Create Market · Seed $${liquidityStr} USDC`}
          </button>
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            Connect your wallet to create a market
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 text-center">{error.message}</p>
        )}
      </div>
    </div>
  );
}
