"use client";
import { useState } from "react";
import { prepareContractCall } from "thirdweb";
import { useSendTransaction } from "thirdweb/react";
import { oracleXContract } from "@/hooks/useMarkets";
import { Sparkles } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

interface AiResolution { outcome: 1 | 2 | 3; confidenceBps: number; reasoning: string; }
interface Props { marketId: bigint; question: string; category: string; resolutionSource: string; onSettled: () => void; }

const OUTCOME_LABEL: Record<number, string> = { 1: "YES", 2: "NO", 3: "INVALID" };
const OUTCOME_BTN: Record<number, string> = {
  1: "bg-[#99ff88] text-black border-black",
  2: "bg-[#ff6961] text-white border-black",
  3: "bg-black text-white border-black",
};

export function AdminResolvePanel({ marketId, question, category, resolutionSource, onSettled }: Props) {
  const [status,     setStatus]     = useState<"idle" | "asking" | "ready" | "error">("idle");
  const [resolution, setResolution] = useState<AiResolution | null>(null);
  const [aiError,    setAiError]    = useState<string | null>(null);
  const { mutate: sendTx, isPending: txPending, error: txError } = useSendTransaction();

  async function askAI() {
    setStatus("asking"); setAiError(null);
    try {
      const r = await fetch(`${BACKEND_URL}/ai/resolve-market`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, category, resolutionSource }),
      });
      if (!r.ok) throw new Error(`Backend returned ${r.status}`);
      const data = await r.json() as AiResolution;
      setResolution(data); setStatus("ready");
    } catch (e) { setAiError((e as Error).message); setStatus("error"); }
  }

  function submitResolution() {
    if (!resolution) return;
    sendTx(
      prepareContractCall({
        contract: oracleXContract, method: "receiveSettlement",
        params: [marketId, resolution.outcome, BigInt(resolution.confidenceBps), resolution.reasoning],
      }),
      { onSuccess: () => { setStatus("idle"); setResolution(null); onSettled(); } },
    );
  }

  const confidencePct = resolution ? (resolution.confidenceBps / 100).toFixed(1) : "0";
  const belowThreshold = resolution && resolution.outcome !== 3 && resolution.confidenceBps < 8000;

  return (
    <div className="border-4 border-[#d3aeff] rounded-2xl p-4 bg-[#d3aeff]/20">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-bold text-sm" style={{ fontFamily: "'Brice SemiBold', sans-serif" }}>
          Admin · AI Resolve
        </span>
        <span className="text-xs px-2 py-0.5 border-2 border-black rounded-full bg-[#d3aeff]">
          Owner only
        </span>
      </div>

      <p className="text-xs text-black/50 mb-4">
        Simulates the Chainlink CRE workflow: ask AI → submit outcome on-chain.
      </p>

      {(status === "idle" || status === "error") && (
        <button onClick={askAI} className="retro-btn w-full bg-[#d3aeff] text-black py-2.5 text-sm flex items-center justify-center gap-2">
          <Sparkles size={14} /> Ask AI to Resolve →
        </button>
      )}

      {status === "asking" && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm">
          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          Consulting Llama 3.3 70B…
        </div>
      )}

      {aiError && <p className="text-xs text-[#ff6961] mt-1">Error: {aiError}</p>}

      {status === "ready" && resolution && (
        <div className="space-y-3">
          {/* Outcome badge */}
          <div className={`flex items-center justify-between rounded-xl border-4 border-black px-3 py-2 ${OUTCOME_BTN[resolution.outcome]}`}>
            <span className="font-bold" style={{ fontFamily: "'Brice Black', sans-serif" }}>
              {OUTCOME_LABEL[resolution.outcome]}
            </span>
            <span className="text-xs opacity-80">{confidencePct}% confidence</span>
          </div>

          {/* Reasoning */}
          <div className="border-4 border-black/10 rounded-2xl p-3 bg-white/60">
            <p className="text-xs text-black/40 mb-1">AI Reasoning</p>
            <p className="text-sm leading-relaxed">{resolution.reasoning}</p>
          </div>

          {/* Confidence bar */}
          <div>
            <div className="flex justify-between text-xs text-black/40 mb-1">
              <span>Confidence</span>
              <span>{confidencePct}% {belowThreshold ? "⚠ below 80%" : ""}</span>
            </div>
            <div className="h-3 border-2 border-black rounded-full overflow-hidden bg-black/10">
              <div
                className={`h-full rounded-full ${resolution.confidenceBps >= 8000 ? "bg-[#99ff88]" : "bg-[#ff6961]"}`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>

          {/* Override */}
          <div>
            <p className="text-xs text-black/40 mb-1.5">Override if needed:</p>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setResolution({ ...resolution, outcome: o })}
                  className={`flex-1 py-1.5 rounded-xl border-4 text-xs font-bold transition-all ${
                    resolution.outcome === o ? OUTCOME_BTN[o] : "border-black/20 bg-white text-black/50"
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
            className="retro-btn w-full bg-black text-white py-3 text-sm"
          >
            {txPending ? "Submitting…" : `Confirm: ${OUTCOME_LABEL[resolution.outcome]} →`}
          </button>

          <button onClick={() => { setStatus("idle"); setResolution(null); }} className="w-full text-xs text-black/40 py-1 hover:text-black/60">
            Reset
          </button>

          {txError && <p className="text-xs text-[#ff6961]">{txError.message}</p>}
        </div>
      )}
    </div>
  );
}
