import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x" + "0".repeat(64);
const ALCHEMY_KEY  = process.env.ALCHEMY_KEY  ?? "";
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY ?? "";

const config: HardhatUserConfig = {
  paths: {
    sources: "./src",
  },
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
    },
    "base-sepolia": {
      url: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
      accounts: [PRIVATE_KEY],
      chainId: 84532,
    },
    "worldchain-sepolia": {
      url: "https://worldchain-sepolia.g.alchemy.com/public",
      accounts: [PRIVATE_KEY],
      chainId: 4801,
    },
    "worldchain": {
      url: "https://worldchain-mainnet.g.alchemy.com/public",
      accounts: [PRIVATE_KEY],
      chainId: 480,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_KEY,
      "base-sepolia": process.env.BASESCAN_KEY ?? "",
    },
    customChains: [
      {
        network: "base-sepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },
};

export default config;
