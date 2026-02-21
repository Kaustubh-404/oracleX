import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying MockUSDC with:", deployer.address);

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const address = await usdc.getAddress();
  console.log("MockUSDC deployed to:", address);
  console.log("\nAdd to your .env:");
  console.log(`USDC_ADDRESS=${address}`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${address}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
