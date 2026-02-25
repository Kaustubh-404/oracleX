/** Stores/reads the MiniKit wallet address obtained via walletAuth */

const KEY = "minikit_address";

export function getMiniKitAddress(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setMiniKitAddress(addr: string): void {
  localStorage.setItem(KEY, addr);
}

export function clearMiniKitAddress(): void {
  localStorage.removeItem(KEY);
}

/** Generates a random nonce (8+ alphanumeric chars) for walletAuth */
export function generateNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
