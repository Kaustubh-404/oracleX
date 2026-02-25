"use client";
import { useReadContract } from "thirdweb/react";
import { getContract } from "thirdweb";
import { client, CHAIN, ORACLEX_ADDRESS, WORLD_CHAIN } from "@/lib/thirdweb";
import { WORLD_ORACLEX_ADDRESS } from "@/lib/worldchain";
import { ORACLE_X_ABI } from "@/abis/OracleX";
import { parseMarket } from "@/lib/utils";

const sepoliaContract = getContract({
  client,
  chain: CHAIN,
  address: ORACLEX_ADDRESS,
  abi: ORACLE_X_ABI,
});

const worldContract = getContract({
  client,
  chain: WORLD_CHAIN,
  address: WORLD_ORACLEX_ADDRESS,
  abi: ORACLE_X_ABI,
});

function contractForChain(chain: string) {
  return chain === "worldchain-sepolia" ? worldContract : sepoliaContract;
}

export function useMarketCount() {
  return useReadContract({
    contract: sepoliaContract,
    method: "marketCount",
    params: [],
  });
}

export function useMarket(marketId: bigint, chain = "sepolia") {
  const contract = contractForChain(chain);
  const raw = useReadContract({
    contract,
    method: "getMarket",
    params: [marketId],
  });
  return { ...raw, data: raw.data ? parseMarket(raw.data) : undefined };
}

export function useOdds(marketId: bigint, chain = "sepolia") {
  return useReadContract({
    contract: contractForChain(chain),
    method: "getOdds",
    params: [marketId],
  });
}

export function useUserPositions(marketId: bigint, userAddress: string | undefined, chain = "sepolia") {
  return useReadContract({
    contract: contractForChain(chain),
    method: "getUserPositions",
    params: [marketId, (userAddress ?? "0x0") as `0x${string}`],
    queryOptions: { enabled: !!userAddress },
  });
}

export function useActiveMarkets() {
  return useReadContract({
    contract: sepoliaContract,
    method: "getActiveMarkets",
    params: [],
  });
}

// Export contracts for use in transactions
export { sepoliaContract as oracleXContract, worldContract as worldOracleXContract };
