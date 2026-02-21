"use client";
import { useState } from "react";
import { prepareContractCall, getContract } from "thirdweb";
import { useSendTransaction, useActiveAccount, useReadContract } from "thirdweb/react";
import { client, CHAIN, ORACLEX_ADDRESS, USDC_ADDRESS } from "@/lib/thirdweb";
import { ORACLE_X_ABI, USDC_ABI } from "@/abis/OracleX";
import { parseUSDC, formatUSDC } from "@/lib/utils";
import { BuyUSDCButton } from "./BuyUSDCModal";

const oracleXContract = getContract({ client, chain: CHAIN, address: ORACLEX_ADDRESS, abi: ORACLE_X_ABI });
const usdcContract    = getContract({ client, chain: CHAIN, address: USDC_ADDRESS, abi: USDC_ABI });

interface Props {
  marketId: bigint;
  yesPct:   number;
  noPct:    number;
  onSuccess?: () => void;
}

type Action = "BUY" | "SELL";
type Side   = "YES" | "NO";

export function TradePanel({ marketId, yesPct, noPct, onSuccess }: Props) {
  const account = useActiveAccount();
  const { mutate: sendApproveTx, isPending: approvePending } = useSendTransaction();
  const { mutate: sendTradeTx,   isPending: tradePending, error } = useSendTransaction();
  const isPending = approvePending || tradePending;

  const [action, setAction]     = useState<Action>("BUY");
  const [side, setSide]         = useState<Side>("YES");
  const [inputValue, setInput]  = useState("10");

  const usdcAmount = parseUSDC(inputValue);
  const price      = side === "YES" ? yesPct / 100 : noPct / 100;

  // Read user's USDC balance
  const { data: usdcBalance } = useReadContract({
    contract: usdcContract,
    method:   "balanceOf",
    params:   account ? [account.address as `0x${string}`] : ["0x0000000000000000000000000000000000000000" as `0x${string}`],
  });
  const usdcBalanceNum = usdcBalance ? Number(usdcBalance) / 1e6 : 0;
  const isLowBalance   = account && usdcBalanceNum < 5;

  // Read current USDC allowance — skip approve if already sufficient
  const { data: allowance } = useReadContract({
    contract: usdcContract,
    method:   "allowance",
    params:   account
      ? [account.address as `0x${string}`, ORACLEX_ADDRESS as `0x${string}`]
      : ["0x0000000000000000000000000000000000000000" as `0x${string}`, ORACLEX_ADDRESS as `0x${string}`],
  });

  // Read user's current position sizes for sell UI
  const { data: positions, refetch: refetchPositions } = useReadContract({
    contract: oracleXContract,
    method:   "getUserPositions",
    params:   account ? [marketId, account.address as `0x${string}`] : [0n, "0x0000000000000000000000000000000000000000" as `0x${string}`],
  });
  const yesPos  = positions ? positions[0] : 0n;
  const noPos   = positions ? positions[1] : 0n;
  const maxSell = side === "YES" ? yesPos : noPos;
  const hasAnyPosition = yesPos > 0n || noPos > 0n;

  // BUY summary
  const shares      = price > 0 ? Number(inputValue) / price : 0;
  const potentialWin = price > 0 ? Number(inputValue) / price : 0;

  // SELL summary — proceeds = amount * ownPool / totalPool ≈ price × amount
  const sellProceeds = price > 0 ? Number(inputValue) * price : 0;
  const sellAfterFee = sellProceeds * 0.99; // 1% protocol fee

  function handleBuy() {
    if (!account || usdcAmount === 0n) return;

    const doBuy = () => {
      const buyTx = prepareContractCall({
        contract: oracleXContract,
        method:   side === "YES" ? "buyYes" : "buyNo",
        params:   [marketId, usdcAmount],
      });
      sendTradeTx(buyTx, { onSuccess: () => { setInput("10"); onSuccess?.(); } });
    };

    // If allowance is already sufficient, skip the approve step entirely
    const hasAllowance = allowance !== undefined && allowance >= usdcAmount;
    if (hasAllowance) {
      doBuy();
      return;
    }

    // Approve max uint256 so future trades never need to approve again
    const MAX = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    const approveTx = prepareContractCall({
      contract: usdcContract,
      method:   "approve",
      params:   [ORACLEX_ADDRESS, MAX],
    });

    sendApproveTx(approveTx, { onSuccess: doBuy });
  }

  function handleSell() {
    if (!account || usdcAmount === 0n) return;

    const sellTx = prepareContractCall({
      contract: oracleXContract,
      method:   "sellShares",
      params:   [marketId, side === "YES", usdcAmount],
    });
    sendTradeTx(sellTx, {
      onSuccess: () => { setInput("10"); refetchPositions(); onSuccess?.(); },
    });
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      {/* BUY / SELL tab */}
      <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1">
        {(["BUY", "SELL"] as Action[]).map((a) => (
          <button
            key={a}
            onClick={() => setAction(a)}
            className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-all ${
              action === a
                ? a === "BUY"
                  ? "bg-blue-600 text-white"
                  : "bg-orange-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {/* No position warning on SELL tab */}
      {action === "SELL" && account && !hasAnyPosition && (
        <div className="text-center py-6 text-gray-500">
          <p className="text-2xl mb-2">📭</p>
          <p className="text-sm text-gray-400 font-medium">No open position</p>
          <p className="text-xs mt-1">Buy YES or NO first to get a position you can sell.</p>
          <button
            onClick={() => setAction("BUY")}
            className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Switch to Buy →
          </button>
        </div>
      )}

      {/* Side selector (YES / NO) */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {(["YES", "NO"] as Side[]).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`py-2.5 rounded-lg font-semibold text-sm transition-all ${
              side === s
                ? s === "YES"
                  ? "bg-green-500 text-white"
                  : "bg-red-500 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {s} · {s === "YES" ? yesPct : noPct}%
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <label className="text-xs text-gray-500">Amount (USDC)</label>
          {action === "SELL" && account && (
            <button
              onClick={() => setInput((Number(maxSell) / 1e6).toFixed(2))}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Max: {formatUSDC(maxSell)}
            </button>
          )}
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
          <input
            type="number"
            min="1"
            value={inputValue}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-1 mt-2">
          {["5", "10", "25", "50"].map((v) => (
            <button
              key={v}
              onClick={() => setInput(v)}
              className="flex-1 text-xs py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
            >
              ${v}
            </button>
          ))}
        </div>
      </div>

      {/* Trade summary */}
      <div className="bg-gray-800/50 rounded-lg p-3 mb-4 text-xs space-y-1.5">
        {action === "BUY" ? (
          <>
            <div className="flex justify-between text-gray-400">
              <span>Shares received</span>
              <span className="text-gray-200">{shares.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Price per share</span>
              <span className="text-gray-200">${price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-gray-700 pt-1.5">
              <span className="text-gray-300">If {side} wins</span>
              <span className="text-green-400">${potentialWin.toFixed(2)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between text-gray-400">
              <span>Shares sold</span>
              <span className="text-gray-200">{Number(inputValue).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Est. proceeds (pre-fee)</span>
              <span className="text-gray-200">${sellProceeds.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-gray-700 pt-1.5">
              <span className="text-gray-300">After 1% fee</span>
              <span className="text-orange-400">${sellAfterFee.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      {/* Low USDC balance warning */}
      {action === "BUY" && isLowBalance && (
        <div className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-3 text-xs">
          <span className="text-yellow-300">
            Balance: ${usdcBalanceNum.toFixed(2)} USDC
          </span>
          <BuyUSDCButton
            label="Top up →"
            className="text-xs font-semibold text-yellow-300 hover:text-yellow-200 underline"
          />
        </div>
      )}

      {/* CTA */}
      {account ? (
        <button
          onClick={action === "BUY" ? handleBuy : handleSell}
          disabled={isPending || usdcAmount === 0n || (action === "SELL" && usdcAmount > maxSell)}
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-all text-white disabled:cursor-not-allowed ${
            action === "BUY"
              ? side === "YES"
                ? "bg-green-600 hover:bg-green-500 disabled:bg-green-900/50"
                : "bg-red-600 hover:bg-red-500 disabled:bg-red-900/50"
              : "bg-orange-600 hover:bg-orange-500 disabled:bg-orange-900/50"
          }`}
        >
          {isPending
            ? "Confirming..."
            : action === "BUY"
              ? `Buy ${side} · $${inputValue}`
              : `Sell ${side} · $${inputValue}`}
        </button>
      ) : (
        <p className="text-center text-sm text-gray-500 py-3">
          Connect your wallet to trade
        </p>
      )}

      {action === "SELL" && usdcAmount > maxSell && account && (
        <p className="mt-2 text-xs text-orange-400 text-center">
          Exceeds your position of {formatUSDC(maxSell)}
        </p>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400">{error.message}</p>
      )}
    </div>
  );
}
