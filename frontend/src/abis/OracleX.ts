export const ORACLE_X_ABI = [
  {
    name: "createMarket",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "question",          type: "string"  },
      { name: "category",          type: "string"  },
      { name: "resolutionSource",  type: "string"  },
      { name: "closingTime",       type: "uint256" },
      { name: "settlementDeadline",type: "uint256" },
      { name: "collateralToken",   type: "address" },
      { name: "initialLiquidity",  type: "uint256" },
    ],
    outputs: [{ name: "marketId", type: "uint256" }],
  },
  {
    name: "buyYes",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "amount",   type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "buyNo",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "amount",   type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "requestSettlement",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "sellShares",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "isYes",    type: "bool"    },
      { name: "amount",   type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "receiveSettlement",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId",      type: "uint256" },
      { name: "outcomeValue",  type: "uint8"   },
      { name: "confidenceBps", type: "uint256" },
      { name: "aiReasoning",   type: "string"  },
    ],
    outputs: [],
  },
  {
    name: "claimWinnings",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getMarket",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id",                  type: "uint256" },
          { name: "question",            type: "string"  },
          { name: "category",            type: "string"  },
          { name: "resolutionSource",    type: "string"  },
          { name: "closingTime",         type: "uint256" },
          { name: "settlementDeadline",  type: "uint256" },
          { name: "collateral",          type: "address" },
          { name: "yesPool",             type: "uint256" },
          { name: "noPool",              type: "uint256" },
          { name: "outcome",             type: "uint8"   },
          { name: "settlementRequested", type: "bool"    },
          { name: "aiConfidenceBps",     type: "uint256" },
          { name: "creator",             type: "address" },
        ],
      },
    ],
  },
  {
    name: "getOdds",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      { name: "yesPct", type: "uint256" },
      { name: "noPct",  type: "uint256" },
    ],
  },
  {
    name: "getUserPositions",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "user",     type: "address" },
    ],
    outputs: [
      { name: "yesAmount", type: "uint256" },
      { name: "noAmount",  type: "uint256" },
    ],
  },
  {
    name: "getActiveMarkets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "marketCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "creForwarder",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  // Events
  {
    name: "MarketCreated",
    type: "event",
    inputs: [
      { name: "marketId",   type: "uint256", indexed: true  },
      { name: "question",   type: "string",  indexed: false },
      { name: "category",   type: "string",  indexed: false },
      { name: "closingTime",type: "uint256", indexed: false },
      { name: "creator",    type: "address", indexed: false },
    ],
  },
  {
    name: "MarketSettled",
    type: "event",
    inputs: [
      { name: "marketId",      type: "uint256", indexed: true  },
      { name: "outcome",       type: "uint8",   indexed: false },
      { name: "confidenceBps", type: "uint256", indexed: false },
      { name: "aiReasoning",   type: "string",  indexed: false },
    ],
  },
  {
    name: "SettlementRequested",
    type: "event",
    inputs: [
      { name: "marketId",    type: "uint256", indexed: true  },
      { name: "question",    type: "string",  indexed: false },
      { name: "requestedAt", type: "uint256", indexed: false },
    ],
  },
  {
    name: "PositionSold",
    type: "event",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true  },
      { name: "user",     type: "address", indexed: true  },
      { name: "isYes",    type: "bool",    indexed: false },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "proceeds", type: "uint256", indexed: false },
    ],
  },
] as const;

export const USDC_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "faucet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to",     type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
