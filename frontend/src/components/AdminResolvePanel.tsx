"use client";
import { useState } from "react";
import { prepareContractCall } from "thirdweb";
import { useSendTransaction } from "thirdweb/react";
import { oracleXContract } from "@/hooks/useMarkets";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

interface AiResolution {
  outcome:       1 | 2 | 3;
  confidenceBps: number;
  reasoning:     string;
}

interface Props {
  marketId:         bigint;
  question:         string;
  category:         string;
  resolutionSource: string;
  onSettled:        () => void;
}

const OUTCOME_LABEL: Record<number, string> = { 1: "YES", 2: "NO", 3: "INVALID" };
const OUTCOME_COLOR: Record<number, string> = {
  1: "text-green-400 bg-green-500/10 border-green-500/30",
  2: "text-red-400   bg-red-500/10   border-red-500/30",
  3: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
};

export function AdminResolvePanel({ marketId, question, category, resolutionSource, onSettled }: Props) {
  const [status,     setStatus]     = useState<"idle" | "asking" | "ready" | "error">("idle");
  const [resolution, setResolution] = useState<AiResolution | null>(null);
  const [aiError,    setAiError]    = useState<string | null>(null);

  const { mutate: sendTx, isPending: txPending, error: txError } = useSendTransaction();

  async function askAI() {
    setStatus("asking");
    setAiError(null);
    try {
      const r = await fetch(`${BACKEND_URL}/ai/resolve-market`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question, category, resolutionSource }),
      });
      if (!r.ok) throw new Error(`Backend returned ${r.status}`);
      const data = await r.json() as AiResolution;
      setResolution(data);
      setStatus("ready");
    } catch (e) {
      setAiError((e as Error).message);
      setStatus("error");
    }
  }

  function submitResolution() {
    if (!resolution) return;
    const tx = prepareContractCall({
      contract: oracleXContract,
      method:   "receiveSettlement",
      params:   [
        marketId,
        resolution.outcome,
        BigInt(resolution.confidenceBps),
        resolution.reasoning,
      ],
    });
    sendTx(tx, { onSuccess: () => { setStatus("idle"); setResolution(null); onSettled(); } });
  }

  const confidencePct = resolution ? (resolution.confidenceBps / 100).toFixed(1) : "0";
  const belowThreshold = resolution && resolution.outcome !== 3 && resolution.confidenceBps < 8000;

  return (
    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-purple-400 font-semibold text-sm">Admin: AI Resolve</span>
        <span className="text-xs text-purple-500 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
          Owner only
        </span>
      </div>

      <p className="text-xs text-purple-300/70 mb-4">
        Simulates the Chainlink CRE workflow: ask Groq AI for the outcome, then submit
        it on-chain via <code className="text-purple-300">receiveSettlement()</code>.
      </p>

      {/* Idle / ask state */}
      {(status === "idle" || status === "error") && (
        <button
          onClick={askAI}
          className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all"
        >
          Ask AI to Resolve →
        </button>
      )}

      {status === "asking" && (
        <div className="flex items-center justify-center gap-2 py-3 text-purple-300 text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          Consulting Groq llama-3.3-70b…
        </div>
      )}

      {aiError && (
        <p className="text-xs text-red-400 mt-1">Error: {aiError}</p>
      )}

      {/* AI result */}
      {status === "ready" && resolution && (
        <div className="space-y-3">
          {/* Outcome badge */}
          <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${OUTCOME_COLOR[resolution.outcome]}`}>
            <span className="font-bold">{OUTCOME_LABEL[resolution.outcome]}</span>
            <span className="text-xs opacity-80">{confidencePct}% confidence</span>
          </div>

          {/* Reasoning */}
          <div className="bg-gray-800/60 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">AI Reasoning</p>
            <p className="text-sm text-gray-200 leading-relaxed">{resolution.reasoning}</p>
          </div>

          {/* Confidence bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Confidence</span>
              <span>{confidencePct}% {belowThreshold ? "⚠ below 80% threshold" : ""}</span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${resolution.confidenceBps >= 8000 ? "bg-green-500" : "bg-orange-500"}`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>

          {/* Override outcome buttons */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Override outcome if needed:</p>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setResolution({ ...resolution, outcome: o })}
                  className={`flex-1 py-1 rounded text-xs font-semibold border transition-all ${
                    resolution.outcome === o
                      ? OUTCOME_COLOR[o]
                      : "border-gray-700 text-gray-500 hover:border-gray-600"
                  }`}
                >
                  {OUTCOME_LABEL[o]}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={submitResolution}
            disabled={txPending}
            className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold transition-all"
          >
            {txPending ? "Submitting…" : `Confirm: Resolve as ${OUTCOME_LABEL[resolution.outcome]} →`}
          </button>

          <button
            onClick={() => { setStatus("idle"); setResolution(null); }}
            className="w-full text-xs text-gray-600 hover:text-gray-400 py-1"
          >
            Reset
          </button>

          {txError && (
            <p className="text-xs text-red-400">{txError.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
