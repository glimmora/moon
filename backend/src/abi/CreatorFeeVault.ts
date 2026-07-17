export const creatorFeeVaultAbi = [
  {
    type: "function",
    name: "accrueFees",
    inputs: [
      { name: "token", type: "address" },
      { name: "creator", type: "address" },
      { name: "quoteAsset", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimFees",
    inputs: [{ name: "quoteAsset", type: "address" }],
    outputs: [{ name: "amount", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimAllFees",
    inputs: [],
    outputs: [{ name: "total", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "creatorOf",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claimable",
    inputs: [
      { name: "creator", type: "address" },
      { name: "quoteAsset", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "FeesAccrued",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "quoteAsset", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "FeesClaimed",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "quoteAsset", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
