/**
 * World Chain Sepolia contract addresses and helpers.
 * Used when the app is running inside World App (MiniKit).
 */

export const WORLD_CHAIN_ID = 4801;

export const WORLD_ORACLEX_ADDRESS =
  (process.env.NEXT_PUBLIC_WORLD_ORACLEX_ADDRESS as `0x${string}`) ?? "0x0";

export const WORLD_USDC_ADDRESS =
  (process.env.NEXT_PUBLIC_WORLD_USDC_ADDRESS as `0x${string}`) ?? "0x0";

/** MockWLD token used as collateral in World App (18 decimals) */
export const WORLD_WLD_ADDRESS =
  (process.env.NEXT_PUBLIC_WORLD_WLD_ADDRESS as `0x${string}`) ?? "0x0";

/** The chain slug used as the ?chain= query param for backend API calls */
export const WORLD_CHAIN_SLUG = "worldchain-sepolia";
export const SEPOLIA_CHAIN_SLUG = "sepolia";
