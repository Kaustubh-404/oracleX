import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying MockWLD with:", deployer.address);

  const MockWLD = await ethers.getContractFactory("MockWLD");
  const wld = await MockWLD.deploy();
  await wld.waitForDeployment();
  const wldAddress = await wld.getAddress();
  console.log("MockWLD deployed to:", wldAddress);

  // Mint 10,000 WLD to the user's World App wallet
  const userWallet = "0x9f8e3ae6adf9765684f52debdb43af7750328de0";
  const amount = ethers.parseUnits("10000", 18);
  await (await wld.faucet(userWallet, amount)).wait();
  console.log(`Minted 10,000 WLD to ${userWallet}`);

  console.log("\n========================================");
  console.log("Add to .env files:");
  console.log(`NEXT_PUBLIC_WORLD_WLD_ADDRESS=${wldAddress}`);
  console.log(`WORLD_WLD_ADDRESS=${wldAddress}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
