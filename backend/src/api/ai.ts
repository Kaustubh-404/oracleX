/**
 * AI-assisted market creation endpoint.
 * POST /ai/generate-market { category, question }
 * Returns: { resolutionSource, resolutionCriteria, suggestedDuration }
 */
import { Router } from "express";

const router = Router();

const GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions";
const MODEL     = "llama-3.3-70b-versatile";

interface GenerateRequest {
  category: string;
  question: string;
}

interface GenerateResponse {
  resolutionSource:   string;
  resolutionCriteria: string;
  suggestedDuration:  number; // days
}

router.post("/generate-market", async (req, res) => {
  const { category, question } = req.body as GenerateRequest;

  if (!question || !category) {
    return res.status(400).json({ error: "category and question are required" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "GROQ_API_KEY not configured" });
  }

  const systemPrompt = `You are an expert at creating prediction market specifications.
Given a market question and category, you must return a JSON object with exactly these fields:
- resolutionSource: a specific URL or source that will be used to determine the outcome
- resolutionCriteria: a clear, unambiguous description of what must happen for YES to resolve
- suggestedDuration: how many days until this market should close (integer, 1-90)

Respond ONLY with valid JSON, no markdown, no explanation.`;

  const userPrompt = `Category: ${category}
Question: ${question}

Generate the market specification.`;

  try {
    const response = await fetch(GROQ_BASE, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       MODEL,
        temperature: 0.3,
        max_tokens:  512,
        messages:    [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[AI] Groq error:", text);
      return res.status(502).json({ error: "AI service error" });
    }

    const json = await response.json() as { choices: { message: { content: string } }[] };
    const content = json.choices[0]?.message?.content ?? "";

    let parsed: GenerateResponse;
    try {
      parsed = JSON.parse(content) as GenerateResponse;
    } catch {
      // Groq sometimes wraps JSON in backticks — strip them
      const match = content.match(/\{[\s\S]+\}/);
      if (!match) {
        console.error("[AI] Could not parse Groq response:", content);
        return res.status(502).json({ error: "AI returned invalid JSON" });
      }
      parsed = JSON.parse(match[0]) as GenerateResponse;
    }

    res.json(parsed);
  } catch (err) {
    console.error("[AI] generate-market error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /ai/resolve-market
// Given a question + current data source, ask Groq to resolve the outcome.
// Returns: { outcome: 1|2|3, confidenceBps: number, reasoning: string }
// ─────────────────────────────────────────────────────────────────────────────

interface ResolveRequest {
  question:         string;
  category:         string;
  resolutionSource: string;
}

interface ResolveResponse {
  outcome:      1 | 2 | 3; // 1=YES 2=NO 3=INVALID
  confidenceBps: number;    // 0-10000
  reasoning:    string;
}

router.post("/resolve-market", async (req, res) => {
  const { question, category, resolutionSource } = req.body as ResolveRequest;

  if (!question || !category) {
    return res.status(400).json({ error: "question and category are required" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "GROQ_API_KEY not configured" });
  }

  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = `You are an AI oracle resolving prediction markets based on real-world data.
Today is ${today}. Given a market question, determine whether the outcome is YES, NO, or INVALID.
INVALID means: insufficient data, ambiguous question, or you cannot determine with enough confidence.

Respond ONLY with valid JSON — no markdown, no explanation outside the JSON:
{
  "outcome": 1,
  "confidenceBps": 9200,
  "reasoning": "Plain English explanation, max 280 chars"
}
outcome values: 1 = YES resolved, 2 = NO resolved, 3 = INVALID (cannot determine)
confidenceBps: your confidence 0-10000 (10000 = 100%). Must be ≥ 8000 to settle non-INVALID.`;

  const userPrompt = `Market question: ${question}
Category: ${category}
Resolution source: ${resolutionSource || "general knowledge"}

Based on current publicly available information, has this event occurred (YES), not occurred (NO), or is it impossible to determine (INVALID)?`;

  try {
    const response = await fetch(GROQ_BASE, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       MODEL,
        temperature: 0.1,
        max_tokens:  256,
        messages:    [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[AI] Groq error:", text);
      return res.status(502).json({ error: "AI service error" });
    }

    const json = await response.json() as { choices: { message: { content: string } }[] };
    const content = json.choices[0]?.message?.content ?? "";

    let parsed: ResolveResponse;
    try {
      parsed = JSON.parse(content) as ResolveResponse;
    } catch {
      const match = content.match(/\{[\s\S]+\}/);
      if (!match) {
        console.error("[AI] Could not parse resolve response:", content);
        return res.status(502).json({ error: "AI returned invalid JSON" });
      }
      parsed = JSON.parse(match[0]) as ResolveResponse;
    }

    // Clamp and validate
    const outcome      = ([1, 2, 3] as const).includes(parsed.outcome as 1|2|3) ? parsed.outcome : 3;
    const confidenceBps = Math.min(10000, Math.max(0, Math.round(parsed.confidenceBps ?? 0)));
    const reasoning    = (parsed.reasoning ?? "").slice(0, 280);

    res.json({ outcome, confidenceBps, reasoning } as ResolveResponse);
  } catch (err) {
    console.error("[AI] resolve-market error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
