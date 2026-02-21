import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // 1. Deploy MockUSDC
  console.log("\n--- Deploying MockUSDC ---");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  console.log("MockUSDC deployed to:", await usdc.getAddress());

  // 2. Deploy OracleX
  // For hackathon demo: creForwarder = deployer address
  // You manually call receiveSettlement() after running `cre simulation run`
  // For live CRE deployment: replace with actual CRE forwarder address from Chainlink docs
  const creForwarder = deployer.address;
  console.log("\n--- Deploying OracleX ---");
  console.log("CRE Forwarder:", creForwarder);

  const OracleX = await ethers.getContractFactory("OracleX");
  const oracleX = await OracleX.deploy(creForwarder);
  await oracleX.waitForDeployment();
  const oracleXAddress = await oracleX.getAddress();
  console.log("OracleX deployed to:", oracleXAddress);

  // 3. Seed a demo market for hackathon demo
  console.log("\n--- Creating demo market ---");
  const usdcAddress = await usdc.getAddress();
  const INITIAL_LIQUIDITY = ethers.parseUnits("100", 6); // 100 USDC

  // Approve OracleX to spend USDC
  await (await usdc.approve(oracleXAddress, INITIAL_LIQUIDITY)).wait();

  // Create a demo market that closes in 1 hour
  const closingTime = Math.floor(Date.now() / 1000) + 3600;      // 1 hour from now
  const settlementDeadline = closingTime + 86400;                 // 24h after closing
  const tx = await oracleX.createMarket(
    "Will ETH price be above $3,000 at market close?",
    "crypto",
    "ETH/USD",
    closingTime,
    settlementDeadline,
    usdcAddress,
    INITIAL_LIQUIDITY
  );
  await tx.wait();
  console.log("Demo market #1 created (closes in 1 hour)");

  // 4. Print summary
  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("MockUSDC:    ", await usdc.getAddress());
  console.log("OracleX:     ", oracleXAddress);
  console.log("CRE Forwarder:", creForwarder);
  console.log("\nAdd to your .env:");
  console.log(`NEXT_PUBLIC_ORACLEX_ADDRESS=${oracleXAddress}`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${await usdc.getAddress()}`);
  console.log(`CONTRACT_ADDRESS=${oracleXAddress}`);
  console.log("\nAdd to cre-workflow .env:");
  console.log(`CONTRACT_ADDRESS=${oracleXAddress}`);
  console.log(`COLLATERAL_ADDRESS=${await usdc.getAddress()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
