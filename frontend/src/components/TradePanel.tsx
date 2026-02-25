"use client";
import { useState, useEffect } from "react";
import { isMiniApp, isVerifiedForBet, verifyForBet } from "@/lib/worldid";
import { prepareContractCall, getContract } from "thirdweb";
import { useSendTransaction, useActiveAccount, useReadContract } from "thirdweb/react";
import { client, CHAIN, ORACLEX_ADDRESS, USDC_ADDRESS } from "@/lib/thirdweb";
import { WORLD_ORACLEX_ADDRESS, WORLD_USDC_ADDRESS } from "@/lib/worldchain";
import { ORACLE_X_ABI, USDC_ABI } from "@/abis/OracleX";
import { parseUSDC, formatUSDC } from "@/lib/utils";
import { BuyUSDCButton } from "./BuyUSDCModal";
import { MiniKit } from "@worldcoin/minikit-js";

const oracleXContract = getContract({ client, chain: CHAIN, address: ORACLEX_ADDRESS, abi: ORACLE_X_ABI });
const usdcContract    = getContract({ client, chain: CHAIN, address: USDC_ADDRESS,    abi: USDC_ABI    });

interface Props { marketId: bigint; yesPct: number; noPct: number; chain?: string; onSuccess?: () => void; }
type Action = "BUY" | "SELL";
type Side   = "YES" | "NO";

export function TradePanel({ marketId, yesPct, noPct, chain = "sepolia", onSuccess }: Props) {
  const account = useActiveAccount();
  const { mutate: sendApproveTx, isPending: approvePending } = useSendTransaction();
  const { mutate: sendTradeTx,   isPending: tradePending, error } = useSendTransaction();
  const isPending = approvePending || tradePending;

  const [action, setAction]    = useState<Action>("BUY");
  const [side,   setSide]      = useState<Side>("YES");
  const [inputValue, setInput] = useState("10");
  const [mkPending, setMkPending] = useState(false);
  const [mkError,   setMkError]   = useState<string | null>(null);

  // World ID — only active inside World App
  const inWorldApp = isMiniApp();
  const isWorldChain = chain === "worldchain-sepolia";
  const [widVerified, setWidVerified] = useState(false);
  const [widPending,  setWidPending]  = useState(false);
  const [widError,    setWidError]    = useState<string | null>(null);

  useEffect(() => {
    if (inWorldApp) setWidVerified(isVerifiedForBet(marketId.toString()));
  }, [inWorldApp, marketId]);

  async function handleWorldIDVerify() {
    setWidPending(true); setWidError(null);
    try {
      await verifyForBet(marketId.toString());
      setWidVerified(true);
    } catch (e) {
      setWidError(e instanceof Error ? e.message : "Verification failed");
    } finally { setWidPending(false); }
  }

  const usdcAmount = parseUSDC(inputValue);
  const price      = side === "YES" ? yesPct / 100 : noPct / 100;

  const { data: usdcBalance } = useReadContract({
    contract: usdcContract, method: "balanceOf",
    params: [account?.address ?? "0x0000000000000000000000000000000000000000" as `0x${string}`],
  });
  const usdcBalanceNum = usdcBalance ? Number(usdcBalance) / 1e6 : 0;
  const isLowBalance   = account && usdcBalanceNum < 5;

  const { data: allowance } = useReadContract({
    contract: usdcContract, method: "allowance",
    params: [
      account?.address ?? "0x0000000000000000000000000000000000000000" as `0x${string}`,
      ORACLEX_ADDRESS as `0x${string}`,
    ],
  });

  const { data: positions, refetch: refetchPositions } = useReadContract({
    contract: oracleXContract, method: "getUserPositions",
    params: [marketId, account?.address ?? "0x0000000000000000000000000000000000000000" as `0x${string}`],
  });
  const yesPos  = positions ? positions[0] : 0n;
  const noPos   = positions ? positions[1] : 0n;
  const maxSell = side === "YES" ? yesPos : noPos;
  const hasAnyPosition = yesPos > 0n || noPos > 0n;

  const shares       = price > 0 ? Number(inputValue) / price : 0;
  const potentialWin = shares;
  const sellProceeds = price > 0 ? Number(inputValue) * price : 0;
  const sellAfterFee = sellProceeds * 0.99;

  // ── MiniKit World Chain trading ──────────────────────────────────────────

  const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

  async function handleWorldChainBuy() {
    if (!inWorldApp || !isWorldChain || usdcAmount === 0n) return;
    setMkPending(true); setMkError(null);
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
        setMkError("Approval rejected");
        setMkPending(false);
        return;
      }

      // Step 2: Buy (separate tx so approve is confirmed)
      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: WORLD_ORACLEX_ADDRESS,
            abi: ORACLE_X_ABI as unknown as object[],
            functionName: side === "YES" ? "buyYes" : "buyNo",
            args: [marketId.toString(), usdcAmount.toString()],
          },
        ],
      });
      if (finalPayload.status === "success") {
        setInput("10");
        onSuccess?.();
      } else {
        setMkError("Transaction rejected");
      }
    } catch (e) {
      setMkError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setMkPending(false);
    }
  }

  async function handleWorldChainSell() {
    if (!inWorldApp || !isWorldChain || usdcAmount === 0n) return;
    setMkPending(true); setMkError(null);
    try {
      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: WORLD_ORACLEX_ADDRESS,
            abi: ORACLE_X_ABI as unknown as object[],
            functionName: "sellShares",
            args: [marketId.toString(), side === "YES", usdcAmount.toString()],
          },
        ],
      });
      if (finalPayload.status === "success") {
        setInput("10");
        onSuccess?.();
      } else {
        setMkError("Transaction rejected");
      }
    } catch (e) {
      setMkError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setMkPending(false);
    }
  }

  // ── Sepolia thirdweb trading ─────────────────────────────────────────────

  function handleBuy() {
    if (!account || usdcAmount === 0n) return;
    const doBuy = () => {
      const buyTx = prepareContractCall({
        contract: oracleXContract, method: side === "YES" ? "buyYes" : "buyNo", params: [marketId, usdcAmount],
      });
      sendTradeTx(buyTx, { onSuccess: () => { setInput("10"); onSuccess?.(); } });
    };
    const hasAllowance = allowance !== undefined && allowance >= usdcAmount;
    if (hasAllowance) { doBuy(); return; }
    const MAX = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    sendApproveTx(prepareContractCall({ contract: usdcContract, method: "approve", params: [ORACLEX_ADDRESS, MAX] }), { onSuccess: doBuy });
  }

  function handleSell() {
    if (!account || usdcAmount === 0n) return;
    sendTradeTx(
      prepareContractCall({ contract: oracleXContract, method: "sellShares", params: [marketId, side === "YES", usdcAmount] }),
      { onSuccess: () => { setInput("10"); refetchPositions(); onSuccess?.(); } },
    );
  }

  // ── World App on Sepolia market — direct to browser ──────────────────────

  if (inWorldApp && !isWorldChain) {
    return (
      <div className="retro-card p-5 text-center" style={{ fontFamily: "'Brice Regular', sans-serif" }}>
        <p className="text-3xl mb-3">🌐</p>
        <p className="text-sm font-bold mb-1" style={{ fontFamily: "'Brice SemiBold', sans-serif" }}>
          Trading on Sepolia Testnet
        </p>
        <p className="text-xs text-black/60 mb-4 leading-relaxed">
          Trades run on Ethereum Sepolia.<br />
          Open OracleX in your browser to buy &amp; sell.
        </p>
        <div className="bg-black/5 border-2 border-black/20 rounded-xl p-2.5 mb-4">
          <p className="text-xs font-mono text-black/70 break-all">oracle-x-tawny.vercel.app</p>
        </div>

        {/* Still show World ID verification */}
        {!widVerified ? (
          <div className="border-4 border-black rounded-2xl p-3 bg-[#d3aeff]/30">
            <p className="text-xs font-bold mb-0.5">🌍 Verify you&apos;re human</p>
            <p className="text-xs text-black/60 mb-2">Verify once per market to unlock trading in browser.</p>
            <button
              onClick={handleWorldIDVerify}
              disabled={widPending}
              className="retro-btn w-full bg-black text-white py-2 text-xs"
            >
              {widPending ? "Verifying…" : "Verify with World ID →"}
            </button>
            {widError && <p className="text-xs text-[#ff6961] mt-1">{widError}</p>}
          </div>
        ) : (
          <div className="border-4 border-[#99ff88] rounded-2xl p-3 bg-[#99ff88]/20">
            <p className="text-xs font-bold text-[#2d8a20]">✓ World ID Verified</p>
            <p className="text-xs text-black/60 mt-0.5">Open in browser to complete your trade.</p>
          </div>
        )}
      </div>
    );
  }

  // ── Shared trade UI (browser Sepolia OR World App World Chain) ────────────

  const isWorldChainMode = inWorldApp && isWorldChain;
  const anyPending = isPending || mkPending;

  return (
    <div className="retro-card p-4" style={{ fontFamily: "'Brice Regular', sans-serif" }}>

      {/* World Chain badge */}
      {isWorldChainMode && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-[#d3aeff]/20 border-2 border-[#d3aeff] rounded-xl">
          <span className="text-xs font-bold">🌐 World Chain Sepolia</span>
          <span className="text-xs text-black/50 ml-auto">via World App</span>
        </div>
      )}

      {/* BUY / SELL tabs */}
      <div className="flex gap-2 mb-4">
        {(["BUY", "SELL"] as Action[]).map((a) => (
          <button
            key={a}
            onClick={() => setAction(a)}
            className={`flex-1 py-2.5 rounded-xl text-sm border-4 border-black transition-all ${
              action === a
                ? a === "BUY" ? "bg-black text-white" : "bg-[#ff6961] text-white"
                : "bg-white text-black"
            }`}
            style={{ fontFamily: "'Brice SemiBold', sans-serif" }}
          >
            {a}
          </button>
        ))}
      </div>

      {/* No position on SELL (only for browser Sepolia) */}
      {action === "SELL" && account && !hasAnyPosition && !isWorldChainMode && (
        <div className="text-center py-6 border-4 border-dashed border-black/20 rounded-2xl mb-4">
          <p className="text-2xl mb-2">📭</p>
          <p className="text-sm font-bold">No open position</p>
          <p className="text-xs text-black/50 mt-1">Buy YES or NO first</p>
          <button onClick={() => setAction("BUY")} className="mt-3 text-xs underline decoration-dotted text-black/60">
            Switch to Buy →
          </button>
        </div>
      )}

      {/* YES / NO selector */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {(["YES", "NO"] as Side[]).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`py-3 rounded-xl border-4 border-black text-sm transition-all ${
              side === s
                ? s === "YES" ? "bg-[#99ff88] text-black" : "bg-[#ff6961] text-white"
                : "bg-white text-black"
            }`}
            style={{ fontFamily: "'Brice SemiBold', sans-serif" }}
          >
            {s} · {s === "YES" ? yesPct : noPct}%
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="mb-4">
        <div className="flex justify-between mb-1.5">
          <label className="text-xs text-black/50">Amount (USDC)</label>
          {action === "SELL" && account && !isWorldChainMode && (
            <button
              onClick={() => setInput((Number(maxSell) / 1e6).toFixed(2))}
              className="text-xs underline decoration-dotted text-black/60"
            >
              Max: {formatUSDC(maxSell)}
            </button>
          )}
        </div>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold">$</span>
          <input
            type="number" min="1" value={inputValue} onChange={(e) => setInput(e.target.value)}
            className="w-full border-4 border-black rounded-xl pl-8 pr-4 py-3 bg-white focus:outline-none text-sm"
          />
        </div>
        <div className="flex gap-1.5 mt-2">
          {["5", "10", "25", "50"].map((v) => (
            <button key={v} onClick={() => setInput(v)}
              className="flex-1 text-xs py-1.5 border-2 border-black rounded-lg bg-white hover:bg-black hover:text-white transition-colors">
              ${v}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="border-4 border-black/10 rounded-2xl p-3 mb-4 bg-white/60 text-xs space-y-1.5">
        {action === "BUY" ? (
          <>
            <div className="flex justify-between text-black/50">
              <span>Shares received</span><span className="font-bold text-black">{shares.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-black/50">
              <span>Price per share</span><span className="font-bold text-black">${price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold border-t-2 border-black/10 pt-1.5">
              <span>If {side} wins</span>
              <span className="text-[#2d8a20]">${potentialWin.toFixed(2)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between text-black/50">
              <span>Shares sold</span><span className="font-bold text-black">{Number(inputValue).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-black/50">
              <span>Est. proceeds</span><span className="font-bold text-black">${sellProceeds.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold border-t-2 border-black/10 pt-1.5">
              <span>After 1% fee</span>
              <span className="text-[#ff6961]">${sellAfterFee.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      {/* Low balance — only for browser */}
      {action === "BUY" && isLowBalance && !isWorldChainMode && (
        <div className="flex items-center justify-between border-4 border-black/20 rounded-xl px-3 py-2 mb-3 bg-yellow-100 text-xs">
          <span className="font-bold">Balance: ${usdcBalanceNum.toFixed(2)} USDC</span>
          <BuyUSDCButton label="Top up →" className="text-xs font-bold underline decoration-dotted" />
        </div>
      )}

      {/* World ID gate */}
      {inWorldApp && action === "BUY" && !widVerified && (
        <div className="border-4 border-black rounded-2xl p-3 mb-3 bg-[#d3aeff]/30">
          <p className="text-xs font-bold mb-0.5">🌍 Human verification required</p>
          <p className="text-xs text-black/60 mb-2">One unique human · one position per market.</p>
          <button
            onClick={handleWorldIDVerify}
            disabled={widPending}
            className="retro-btn w-full bg-black text-white py-2 text-xs"
          >
            {widPending ? "Verifying…" : "Verify with World ID →"}
          </button>
          {widError && <p className="text-xs text-[#ff6961] mt-1">{widError}</p>}
        </div>
      )}

      {/* CTA */}
      {isWorldChainMode ? (
        // World App + World Chain: use MiniKit
        <button
          onClick={action === "BUY" ? handleWorldChainBuy : handleWorldChainSell}
          disabled={anyPending || usdcAmount === 0n || (action === "BUY" && !widVerified)}
          className={`retro-btn w-full py-3.5 text-sm ${
            action === "BUY"
              ? side === "YES" ? "bg-[#99ff88] text-black" : "bg-[#ff6961] text-white"
              : "bg-black text-white"
          }`}
        >
          {anyPending ? "Confirming…" : action === "BUY" ? `Buy ${side} · $${inputValue}` : `Sell ${side} · $${inputValue}`}
        </button>
      ) : account ? (
        // Browser: use thirdweb
        <button
          onClick={action === "BUY" ? handleBuy : handleSell}
          disabled={isPending || usdcAmount === 0n || (action === "SELL" && usdcAmount > maxSell)}
          className={`retro-btn w-full py-3.5 text-sm ${
            action === "BUY"
              ? side === "YES" ? "bg-[#99ff88] text-black" : "bg-[#ff6961] text-white"
              : "bg-black text-white"
          }`}
        >
          {isPending ? "Confirming…" : action === "BUY" ? `Buy ${side} · $${inputValue}` : `Sell ${side} · $${inputValue}`}
        </button>
      ) : (
        <p className="text-center text-sm text-black/40 py-3">Connect wallet to trade</p>
      )}

      {action === "SELL" && usdcAmount > maxSell && account && !isWorldChainMode && (
        <p className="mt-2 text-xs text-[#ff6961] text-center">Exceeds your position of {formatUSDC(maxSell)}</p>
      )}
      {error && <p className="mt-2 text-xs text-[#ff6961] text-center">{error.message}</p>}
      {mkError && <p className="mt-2 text-xs text-[#ff6961] text-center">{mkError}</p>}
    </div>
  );
}
