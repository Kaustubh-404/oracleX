"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { prepareContractCall, getContract } from "thirdweb";
import { client, CHAIN, ORACLEX_ADDRESS } from "@/lib/thirdweb";
import { ORACLE_X_ABI } from "@/abis/OracleX";
import {
  useMarket,
  useUserPositions,
  useMarketCount,
} from "@/hooks/useMarkets";
import {
  formatUSDC,
  formatTimeLeft,
  OUTCOME_LABEL,
  OUTCOME_COLOR,
  CATEGORY_META,
} from "@/lib/utils";

const oracleXContract = getContract({
  client,
  chain: CHAIN,
  address: ORACLEX_ADDRESS,
  abi: ORACLE_X_ABI,
});

function PositionRow({
  marketId,
  userAddress,
}: {
  marketId: bigint;
  userAddress: string;
}) {
  const { data: market }    = useMarket(marketId);
  const { data: positions } = useUserPositions(marketId, userAddress);
  const { mutate: sendTx, isPending } = useSendTransaction();

  if (!market || !positions) return null;

  const yesAmt = positions[0];
  const noAmt  = positions[1];

  // No position in this market
  if (yesAmt === 0n && noAmt === 0n) return null;

  const outcome   = Number(market.outcome);
  const isOpen    = outcome === 0;
  const category  = CATEGORY_META[market.category] ?? CATEGORY_META.default;
  const totalPool = market.yesPool + market.noPool;

  // Estimate current value at current odds
  const yesPct = totalPool > 0n ? (Number(market.yesPool) * 100) / Number(totalPool) : 50;
  const noPct  = 100 - yesPct;

  const estimatedValue =
    yesAmt > 0n
      ? (Number(yesAmt) / 1e6) * (yesPct / 100)
      : (Number(noAmt) / 1e6) * (noPct / 100);

  // Settled payout
  const canClaim =
    !isOpen &&
    ((outcome === 1 && yesAmt > 0n) ||
      (outcome === 2 && noAmt > 0n) ||
      (outcome === 3 && (yesAmt > 0n || noAmt > 0n)));

  function handleClaim() {
    const tx = prepareContractCall({
      contract: oracleXContract,
      method:   "claimWinnings",
      params:   [marketId],
    });
    sendTx(tx);
  }

  return (
    <tr className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
      <td className="py-3 pl-4 pr-2">
        <Link href={`/markets/${marketId}`} className="hover:text-white transition-colors">
          <span className={`text-xs px-1.5 py-0.5 rounded-full mr-2 ${category.color}`}>
            {category.emoji}
          </span>
          <span className="text-sm text-gray-300 line-clamp-1">
            {market.question}
          </span>
        </Link>
      </td>
      <td className="py-3 px-2 text-center">
        <div className="flex flex-col gap-0.5">
          {yesAmt > 0n && (
            <span className="text-xs text-green-400">YES {formatUSDC(yesAmt)}</span>
          )}
          {noAmt > 0n && (
            <span className="text-xs text-red-400">NO {formatUSDC(noAmt)}</span>
          )}
        </div>
      </td>
      <td className="py-3 px-2 text-center text-xs text-gray-400">
        {isOpen
          ? `~$${estimatedValue.toFixed(2)}`
          : canClaim
          ? <span className="text-green-400 font-semibold">Claimable</span>
          : <span className="text-gray-600">—</span>}
      </td>
      <td className="py-3 px-2 text-center">
        <span className={`text-xs font-medium ${OUTCOME_COLOR[outcome]}`}>
          {isOpen ? formatTimeLeft(market.closingTime) : OUTCOME_LABEL[outcome]}
        </span>
      </td>
      <td className="py-3 pr-4 pl-2 text-right">
        {canClaim ? (
          <button
            onClick={handleClaim}
            disabled={isPending}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
          >
            {isPending ? "Claiming…" : "Claim"}
          </button>
        ) : isOpen ? (
          <Link
            href={`/markets/${marketId}`}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg"
          >
            Trade
          </Link>
        ) : (
          <span className="text-xs text-gray-600">Done</span>
        )}
      </td>
    </tr>
  );
}

function AllPositions({ address }: { address: string }) {
  const { data: count } = useMarketCount();

  const marketIds = useMemo(() => {
    if (!count) return [];
    const ids: bigint[] = [];
    for (let i = 1n; i <= count; i++) ids.push(i);
    return ids;
  }, [count]);

  if (!count || marketIds.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-4xl mb-3">📭</p>
        <p>No markets found. Start trading!</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="text-xs text-gray-500 bg-gray-800/50">
            <th className="py-3 pl-4 pr-2 text-left font-medium">Market</th>
            <th className="py-3 px-2 text-center font-medium">Your Position</th>
            <th className="py-3 px-2 text-center font-medium">Est. Value</th>
            <th className="py-3 px-2 text-center font-medium">Status</th>
            <th className="py-3 pr-4 pl-2 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {marketIds.map((id) => (
            <PositionRow key={id.toString()} marketId={id} userAddress={address} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PortfolioPage() {
  const account = useActiveAccount();

  if (!account) {
    return (
      <div className="text-center py-24">
        <p className="text-5xl mb-4">👛</p>
        <h2 className="text-xl font-bold text-white mb-2">Connect your wallet</h2>
        <p className="text-gray-400 text-sm">
          Connect to view your prediction market positions.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Portfolio</h1>
        <p className="text-gray-400 text-sm">
          All your active and settled prediction market positions.
        </p>
      </div>

      <AllPositions address={account.address} />
    </div>
  );
}
