import { Router } from "express";
import { prisma } from "../db";

const router = Router();

const WLD_APP_ID = process.env.WLD_APP_ID ?? "";
const WLD_API_KEY = process.env.WLD_API_KEY ?? "";

/**
 * POST /verify/worldid
 *
 * Verifies a World ID proof via Worldcoin's cloud API and stores
 * the nullifier hash to prevent the same human from double-betting
 * on the same market.
 *
 * Body: { action, nullifier_hash, merkle_root, proof, verification_level, market_id? }
 */
router.post("/worldid", async (req, res) => {
  try {
    const { action, nullifier_hash, merkle_root, proof, verification_level, market_id } = req.body;

    if (!action || !nullifier_hash || !merkle_root || !proof || !verification_level) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // Already verified for this action+market? Allow through (idempotent)
    const existing = await prisma.worldIdVerification.findFirst({
      where: { nullifierHash: nullifier_hash, action, marketId: market_id ?? null },
    });
    if (existing) {
      return res.json({ success: true, nullifier_hash, cached: true });
    }

    // Call Worldcoin's verification API
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (WLD_API_KEY) headers["Authorization"] = `Bearer ${WLD_API_KEY}`;

    const verifyRes = await fetch(
      `https://developer.worldcoin.org/api/v2/verify/${WLD_APP_ID}`,
      {
        method:  "POST",
        headers,
        body: JSON.stringify({ nullifier_hash, merkle_root, proof, verification_level, action }),
      }
    );

    if (!verifyRes.ok) {
      const err = await verifyRes.json().catch(() => ({}));
      const msg = (err as { detail?: string }).detail ?? "World ID verification failed";
      console.error("[WorldID] Verification rejected:", msg);
      return res.status(400).json({ success: false, error: msg });
    }

    // Store verified nullifier to prevent double-use on same market
    await prisma.worldIdVerification.create({
      data: {
        nullifierHash:     nullifier_hash,
        action,
        marketId:          market_id ?? null,
        verificationLevel: verification_level,
      },
    });

    console.log(`[WorldID] Verified: action=${action} market=${market_id ?? "n/a"}`);
    res.json({ success: true, nullifier_hash });
  } catch (err) {
    console.error("[WorldID] Error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
