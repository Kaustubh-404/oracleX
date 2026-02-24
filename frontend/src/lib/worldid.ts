import { MiniKit, VerificationLevel, type MiniAppVerifyActionSuccessPayload } from "@worldcoin/minikit-js";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

/** Returns true only when running inside World App */
export function isMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  try { return MiniKit.isInstalled(); } catch { return false; }
}

/** localStorage key for per-market bet verification */
function betKey(marketId: string) { return `wid_bet_${marketId}`; }
/** localStorage key for market-creation verification */
const CREATE_KEY = "wid_create";

export function isVerifiedForBet(marketId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(betKey(marketId)) === "1";
}
export function isVerifiedForCreate(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CREATE_KEY) === "1";
}

export async function verifyForBet(marketId: string): Promise<void> {
  const { finalPayload } = await MiniKit.commandsAsync.verify({
    action: "oraclexbet",
    verification_level: VerificationLevel.Device,
  });
  if (finalPayload.status !== "success") throw new Error("World ID verification cancelled");
  const p = finalPayload as MiniAppVerifyActionSuccessPayload;

  const res = await fetch(`${BACKEND_URL}/verify/worldid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action:             "oraclexbet",
      market_id:          marketId,
      nullifier_hash:     p.nullifier_hash,
      merkle_root:        p.merkle_root,
      proof:              p.proof,
      verification_level: p.verification_level,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "Verification failed");

  localStorage.setItem(betKey(marketId), "1");
}

export async function verifyForCreate(): Promise<void> {
  const { finalPayload } = await MiniKit.commandsAsync.verify({
    action: "oraclexcreatemarket",
    verification_level: VerificationLevel.Device,
  });
  if (finalPayload.status !== "success") throw new Error("World ID verification cancelled");
  const p = finalPayload as MiniAppVerifyActionSuccessPayload;

  const res = await fetch(`${BACKEND_URL}/verify/worldid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action:             "oraclexcreatemarket",
      nullifier_hash:     p.nullifier_hash,
      merkle_root:        p.merkle_root,
      proof:              p.proof,
      verification_level: p.verification_level,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "Verification failed");

  localStorage.setItem(CREATE_KEY, "1");
}
