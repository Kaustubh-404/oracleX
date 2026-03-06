import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const oracleXAddress = "0xd8dCAB1bAE33077a902f51db8DdB22F743FDdb2A";
  const userWallet = "0x9f8e3ae6adf9765684f52debdb43af7750328de0";

  console.log("Deploying MockUSDCWorld with:", deployer.address);
  console.log("Trusted operator (OracleX):", oracleXAddress);

  const MockUSDCWorld = await ethers.getContractFactory("MockUSDCWorld");
  const usdc = await MockUSDCWorld.deploy(oracleXAddress);
  await usdc.waitForDeployment();
  const addr = await usdc.getAddress();
  console.log("MockUSDCWorld deployed to:", addr);

  // Mint 10,000 USDC to user's World App wallet
  const amount = ethers.parseUnits("10000", 6);
  await (await usdc.faucet(userWallet, amount)).wait();
  console.log(`Minted 10,000 USDC to ${userWallet}`);

  console.log("\n========================================");
  console.log("Update .env files:");
  console.log(`NEXT_PUBLIC_WORLD_USDC_ADDRESS=${addr}`);
  console.log(`WORLD_USDC_ADDRESS=${addr}`);
  console.log("\nAdd to Developer Portal → Permit2 Tokens:");
  console.log(addr);
}

main().catch((err) => { console.error(err); process.exit(1); });
