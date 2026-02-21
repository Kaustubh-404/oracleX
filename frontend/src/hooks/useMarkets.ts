"use client";
import { useReadContract } from "thirdweb/react";
import { getContract } from "thirdweb";
import { client, CHAIN, ORACLEX_ADDRESS } from "@/lib/thirdweb";
import { ORACLE_X_ABI } from "@/abis/OracleX";
import { parseMarket } from "@/lib/utils";

const contract = getContract({
  client,
  chain: CHAIN,
  address: ORACLEX_ADDRESS,
  abi: ORACLE_X_ABI,
});

export function useMarketCount() {
  return useReadContract({
    contract,
    method: "marketCount",
    params: [],
  });
}

export function useMarket(marketId: bigint) {
  const raw = useReadContract({
    contract,
    method: "getMarket",
    params: [marketId],
  });
  return { ...raw, data: raw.data ? parseMarket(raw.data) : undefined };
}

export function useOdds(marketId: bigint) {
  return useReadContract({
    contract,
    method: "getOdds",
    params: [marketId],
  });
}

export function useUserPositions(marketId: bigint, userAddress: string | undefined) {
  return useReadContract({
    contract,
    method: "getUserPositions",
    params: [marketId, (userAddress ?? "0x0") as `0x${string}`],
    queryOptions: { enabled: !!userAddress },
  });
}

export function useActiveMarkets() {
  return useReadContract({
    contract,
    method: "getActiveMarkets",
    params: [],
  });
}

// Export contract for use in transactions
export { contract as oracleXContract };
