import { createThirdwebClient } from "thirdweb";
import { sepolia } from "thirdweb/chains";

export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

export const CHAIN = sepolia;

export const ORACLEX_ADDRESS =
  (process.env.NEXT_PUBLIC_ORACLEX_ADDRESS as `0x${string}`) ?? "0x0";

export const USDC_ADDRESS =
  (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`) ?? "0x0";
