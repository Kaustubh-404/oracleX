/**
 * OracleX Market Resolver — Chainlink CRE Workflow
 *
 * Trigger: EVM log — fires when OracleX emits SettlementRequested(uint256,string,uint256)
 *
 * Execution flow:
 *   DON level:
 *     1. Parse marketId from trigger log
 *     2. Read market details from chain via EVMClient.callContract
 *     3. Read GROQ_API_KEY from DON secrets
 *   Per-node (inside runInNodeMode):
 *     4. Fetch external data (CoinGecko / Odds API / NewsAPI)
 *     5. Call Groq AI (llama-3.3-70b-versatile) for outcome decision
 *     6. Validate confidence (must be ≥ 80%)
 *   After consensus (all nodes must agree via consensusIdenticalAggregation):
 *     7. ABI-encode settlement payload
 *     8. runtime.report() + EVMClient.writeReport() → on-chain
 *
 * @chainlink/cre-sdk (installed version)
 */

import {
  EVMClient,
  HTTPClient,
  handler,
  consensusIdenticalAggregation,
  encodeCallMsg,
  prepareReportRequest,
  EVM_DEFAULT_REPORT_ENCODER,
  type Runtime,
  type NodeRuntime,
} from "@chainlink/cre-sdk";
import {
  decodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
  toHex,
  type Address,
  type Hex,
} from "viem";

// ─── Constants ──────────────────────────────────────────────────────────────

const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address;
const CHAIN_SELECTOR   = EVMClient.SUPPORTED_CHAIN_SELECTORS["ethereum-testnet-sepolia"];
const MIN_CONFIDENCE_BPS = 8000;

const evmClient  = new EVMClient(CHAIN_SELECTOR);
const httpClient = new HTTPClient();

// ─── Types ──────────────────────────────────────────────────────────────────

interface MarketData {
  marketId:         bigint;
  question:         string;
  category:         string;
  resolutionSource: string;
  closingTime:      bigint;
  outcome:          number;
}

interface SettlementDecision {
  outcome:       number;   // 1=YES 2=NO 3=INVALID
  confidenceBps: number;   // 0–10000
  reasoning:     string;
}

interface HandlerResult {
  marketId:      string;
  outcome:       number;
  confidenceBps: number;
}

// Cast helper for HTTPClient.sendRequest — avoids overload resolution ambiguity
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHttpInput = any;

// ─── Trigger — EVM log ───────────────────────────────────────────────────────
// Fires on: SettlementRequested(uint256 indexed marketId, string question, uint256 requestedAt)
// After deploying, fill in the keccak256 topic:
//   cast keccak "SettlementRequested(uint256,string,uint256)"
const logTrigger = evmClient.logTrigger({
  addresses: [CONTRACT_ADDRESS],
  // topics: [[<computed topic0>]]   ← fill after deploy
});

// ─── Workflow handler ────────────────────────────────────────────────────────

export default [
  handler(
    logTrigger,
    (runtime: Runtime<unknown>, triggerLog: unknown) => {
      // Parse marketId from indexed topic[1]
      const log = triggerLog as { topics?: string[] };
      const marketIdHex = (log.topics?.[1] ?? "0x0") as Hex;
      const marketId = BigInt(marketIdHex);

      runtime.log(`[OracleX] Resolving market #${marketId}`);

      // ── Read market data at DON level (callContract takes Runtime) ─────────
      const market = readMarket(runtime, marketId);

      if (market.outcome !== 0) {
        runtime.log(`[OracleX] Market #${marketId} already settled — skipping`);
        return { marketId: marketId.toString(), outcome: market.outcome, confidenceBps: 0 } as HandlerResult;
      }

      // ── Read secrets at DON level ──────────────────────────────────────────
      const groqKey = runtime.getSecret({ id: "GROQ_API_KEY" }).result();
      const groqApiKey = groqKey.value;

      // ── Per-node: fetch data + call AI, then consensus ─────────────────────
      const nodeFn = runtime.runInNodeMode(
        (nodeRuntime: NodeRuntime<unknown>, m: MarketData, key: string): SettlementDecision =>
          resolveOnNode(nodeRuntime, m, key),
        consensusIdenticalAggregation<SettlementDecision>()
      );

      const decision = nodeFn(market, groqApiKey).result();
      runtime.log(`[OracleX] Consensus: outcome=${decision.outcome}, confidence=${decision.confidenceBps}bps`);

      // ── ABI-encode the receiveSettlement call ──────────────────────────────
      const calldata = encodeFunctionData({
        abi: [{
          name: "receiveSettlement",
          type: "function",
          inputs: [
            { name: "marketId",      type: "uint256" },
            { name: "outcomeValue",  type: "uint8"   },
            { name: "confidenceBps", type: "uint256" },
            { name: "aiReasoning",   type: "string"  },
          ],
        }],
        functionName: "receiveSettlement",
        args: [
          decision.outcome === 1 ? market.marketId : market.marketId,
          decision.outcome,
          BigInt(decision.confidenceBps),
          decision.reasoning,
        ],
      }) as Hex;

      // ── Wrap in CRE report and write on-chain ──────────────────────────────
      const report = runtime.report(
        prepareReportRequest(calldata, EVM_DEFAULT_REPORT_ENCODER)
      ).result();

      evmClient.writeReport(runtime, {
        receiver: CONTRACT_ADDRESS,
        report,
        gasConfig: { gasLimit: "500000" },
      }).result();

      runtime.log(`[OracleX] Settlement written for market #${marketId}`);
      return { marketId: marketId.toString(), outcome: decision.outcome, confidenceBps: decision.confidenceBps } as HandlerResult;
    }
  ),
];

// ─── Read Market from Chain (DON runtime) ────────────────────────────────────

function readMarket(runtime: Runtime<unknown>, marketId: bigint): MarketData {
  const calldata = encodeFunctionData({
    abi: [{
      name: "getMarket",
      type: "function",
      inputs: [{ name: "marketId", type: "uint256" }],
    }],
    functionName: "getMarket",
    args: [marketId],
  }) as Hex;

  const reply = evmClient.callContract(runtime, {
    call: encodeCallMsg({
      from: "0x0000000000000000000000000000000000000000",
      to:   CONTRACT_ADDRESS,
      data: calldata,
    }),
  }).result();

  const decoded = decodeAbiParameters(
    parseAbiParameters(
      "uint256, string, string, string, uint256, uint256, address, uint256, uint256, uint8, bool, uint256, address"
    ),
    toHex(reply.data)
  );

  return {
    marketId:         decoded[0] as bigint,
    question:         decoded[1] as string,
    category:         decoded[2] as string,
    resolutionSource: decoded[3] as string,
    closingTime:      decoded[4] as bigint,
    outcome:          decoded[9] as number,
  };
}

// ─── Per-Node Resolution (synchronous — uses .result() not await) ────────────

function resolveOnNode(
  nodeRuntime: NodeRuntime<unknown>,
  market: MarketData,
  groqApiKey: string
): SettlementDecision {
  nodeRuntime.log(`[Node] Resolving market #${market.marketId}: "${market.question}"`);

  const dataContext = fetchExternalData(nodeRuntime, market);
  nodeRuntime.log(`[Node] Data fetched (${dataContext.length} chars)`);

  const decision = callGroqAI(nodeRuntime, market, dataContext, groqApiKey);
  nodeRuntime.log(`[Node] AI → outcome=${decision.outcome}, confidence=${decision.confidenceBps}bps`);

  if (decision.confidenceBps < MIN_CONFIDENCE_BPS) {
    nodeRuntime.log(`[Node] Low confidence (${decision.confidenceBps} < ${MIN_CONFIDENCE_BPS}) → INVALID`);
    return {
      outcome:       3,
      confidenceBps: decision.confidenceBps,
      reasoning:     `Insufficient confidence: ${decision.reasoning}`,
    };
  }

  return decision;
}

// ─── External Data Fetcher (per-node) ────────────────────────────────────────

function fetchExternalData(
  nodeRuntime: NodeRuntime<unknown>,
  market: MarketData
): string {
  const parts: string[] = [];
  const category = market.category.toLowerCase();

  if (category === "crypto") {
    try {
      const resp = httpClient.sendRequest(nodeRuntime, {
        url:    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana&per_page=10",
        method: "GET",
        headers: { "Accept": "application/json" },
      } as AnyHttpInput).result();
      const text = resp.body ? new TextDecoder().decode(resp.body) : "[]";
      parts.push(`CoinGecko: ${text.slice(0, 800)}`);
    } catch (e) {
      parts.push(`CoinGecko unavailable: ${e}`);
    }
  }

  if (category === "sports" && process.env.ODDS_API_KEY) {
    try {
      const resp = httpClient.sendRequest(nodeRuntime, {
        url:    `https://api.the-odds-api.com/v4/sports/?apiKey=${process.env.ODDS_API_KEY}`,
        method: "GET",
        headers: { "Accept": "application/json" },
      } as AnyHttpInput).result();
      const text = resp.body ? new TextDecoder().decode(resp.body) : "[]";
      parts.push(`Odds API: ${text.slice(0, 600)}`);
    } catch (e) {
      parts.push(`Odds API unavailable: ${e}`);
    }
  }

  if (process.env.NEWS_API_KEY) {
    try {
      const q = encodeURIComponent(market.question.slice(0, 100));
      const resp = httpClient.sendRequest(nodeRuntime, {
        url:    `https://newsapi.org/v2/everything?q=${q}&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`,
        method: "GET",
        headers: { "Accept": "application/json" },
      } as AnyHttpInput).result();
      const text = resp.body ? new TextDecoder().decode(resp.body) : "{}";
      parts.push(`NewsAPI: ${text.slice(0, 1000)}`);
    } catch (e) {
      parts.push(`NewsAPI unavailable: ${e}`);
    }
  }

  return parts.length ? parts.join("\n\n") : "No external data available.";
}

// ─── Groq AI Decision (per-node, synchronous) ────────────────────────────────

function callGroqAI(
  nodeRuntime: NodeRuntime<unknown>,
  market: MarketData,
  dataContext: string,
  groqApiKey: string
): SettlementDecision {
  const prompt = `You are a neutral prediction market resolver.

MARKET QUESTION: ${market.question}
RESOLUTION SOURCE: ${market.resolutionSource}
MARKET CLOSED AT: ${new Date(Number(market.closingTime) * 1000).toISOString()}
CURRENT TIME: ${nodeRuntime.now().toISOString()}

EXTERNAL DATA:
${dataContext.slice(0, 3000)}

Respond with ONLY valid JSON — no markdown, no extra text:
{"outcome":"YES","confidence_bps":9200,"reasoning":"..."}

Rules:
- outcome: "YES" | "NO" | "INVALID"
- confidence_bps: 0–10000 (10000 = 100% certain)
- Use INVALID when evidence is insufficient or ambiguous
- reasoning: max 300 characters`;

  const bodyJson = JSON.stringify({
    model:           "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "You are a precise prediction market oracle. Reply only with valid JSON." },
      { role: "user",   content: prompt },
    ],
    temperature:     0.1,
    max_tokens:      256,
    response_format: { type: "json_object" },
  });

  let rawText = "{}";
  try {
    // Use the non-JSON Request form (body as Uint8Array)
    const resp = httpClient.sendRequest(
      nodeRuntime,
      {
        url:    "https://api.groq.com/openai/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${groqApiKey}`,
        },
        body: new TextEncoder().encode(bodyJson),
      // Cast because both Request (Uint8Array body) and RequestJson (string body) are valid;
      // the runtime accepts binary body via the protobuf Request type
      } as AnyHttpInput
    ).result();
    rawText = resp.body ? new TextDecoder().decode(resp.body) : "{}";
  } catch (e) {
    nodeRuntime.log(`[Node] Groq HTTP error: ${e}`);
    return { outcome: 3, confidenceBps: 0, reasoning: `API error: ${e}` };
  }

  try {
    const apiResp = JSON.parse(rawText) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = apiResp?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as {
      outcome?: string;
      confidence_bps?: number;
      reasoning?: string;
    };

    const outcomeStr    = (parsed.outcome ?? "INVALID").toUpperCase();
    const confidenceBps = Math.max(0, Math.min(10000, parsed.confidence_bps ?? 0));
    const reasoning     = (parsed.reasoning ?? "No reasoning").slice(0, 500);
    const outcomeNum    = outcomeStr === "YES" ? 1 : outcomeStr === "NO" ? 2 : 3;

    return { outcome: outcomeNum, confidenceBps, reasoning };
  } catch (e) {
    nodeRuntime.log(`[Node] Groq parse error: ${e} — raw: ${rawText.slice(0, 200)}`);
    return { outcome: 3, confidenceBps: 0, reasoning: "AI response parse error" };
  }
}
