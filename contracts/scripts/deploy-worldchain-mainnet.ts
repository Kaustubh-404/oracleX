import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying to World Chain MAINNET with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // 1. Deploy OracleX
  const creForwarder = deployer.address; // For hackathon demo
  console.log("\n--- Deploying OracleX ---");
  const OracleX = await ethers.getContractFactory("OracleX");
  const oracleX = await OracleX.deploy(creForwarder);
  await oracleX.waitForDeployment();
  const oracleXAddress = await oracleX.getAddress();
  console.log("OracleX deployed to:", oracleXAddress);

  // 2. Deploy MockUSDCWorld (auto-approves OracleX)
  console.log("\n--- Deploying MockUSDCWorld ---");
  const MockUSDCWorld = await ethers.getContractFactory("MockUSDCWorld");
  const usdc = await MockUSDCWorld.deploy(oracleXAddress);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("MockUSDCWorld deployed to:", usdcAddress);

  // 3. Mint USDC to user's World App wallet
  const userWallet = "0x9f8e3ae6adf9765684f52debdb43af7750328de0";
  const mintAmount = ethers.parseUnits("10000", 6);
  await (await usdc.faucet(userWallet, mintAmount)).wait();
  console.log(`Minted 10,000 USDC to ${userWallet}`);

  // 4. Seed a demo market
  console.log("\n--- Creating demo market ---");
  const INITIAL_LIQUIDITY = ethers.parseUnits("100", 6);
  // No approve needed — deployer got 1M USDC in constructor, but deployer isn't auto-approved
  // Need to approve first for the deployer
  await (await usdc.approve(oracleXAddress, INITIAL_LIQUIDITY)).wait();
  const closingTime = Math.floor(Date.now() / 1000) + 86400; // 24h
  const settlementDeadline = closingTime + 604800; // +7 days
  await (await oracleX.createMarket(
    "Will ETH price be above $3,000 by end of this week?",
    "crypto",
    "CoinGecko API + Chainlink Price Feeds",
    closingTime,
    settlementDeadline,
    usdcAddress,
    INITIAL_LIQUIDITY
  )).wait();
  console.log("Demo market #1 created");

  // 5. Print summary
  console.log("\n========================================");
  console.log("WORLD CHAIN MAINNET DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("OracleX:       ", oracleXAddress);
  console.log("MockUSDCWorld: ", usdcAddress);
  console.log("\nUpdate .env files:");
  console.log(`NEXT_PUBLIC_WORLD_ORACLEX_ADDRESS=${oracleXAddress}`);
  console.log(`NEXT_PUBLIC_WORLD_USDC_ADDRESS=${usdcAddress}`);
  console.log("\nUpdate Developer Portal:");
  console.log(`Contract Entrypoints: ${oracleXAddress},${usdcAddress}`);
  console.log(`Permit2 Tokens: ${usdcAddress}`);
  console.log("\nRemaining balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
}

main().catch((err) => { console.error(err); process.exit(1); });
