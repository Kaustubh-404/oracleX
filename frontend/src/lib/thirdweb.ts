import { createThirdwebClient, defineChain } from "thirdweb";
import { sepolia } from "thirdweb/chains";

export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

export const CHAIN = sepolia;

export const ORACLEX_ADDRESS =
  (process.env.NEXT_PUBLIC_ORACLEX_ADDRESS as `0x${string}`) ?? "0x0";

export const USDC_ADDRESS =
  (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`) ?? "0x0";

// World Chain mainnet (chain ID 480) — MiniKit only works on mainnet
export const WORLD_CHAIN = defineChain(480);
