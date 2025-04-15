const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  // Get the contract factory for the CollateralizedLoan contract
  const CollateralizedLoan = await ethers.getContractFactory(
    "CollateralizedLoan"
  );

  // Deploy the contract
  const collateralizedLoan = await CollateralizedLoan.deploy();

  // Wait for the deployment transaction to be mined
  await collateralizedLoan.waitForDeployment();

  // Get the contract address
  const deployedAddress = await collateralizedLoan.getAddress();

  // Log the deployed contract address
  console.log("CollateralizedLoan deployed to:", deployedAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("An error occurred during deployment:", error);
    process.exit(1);
  });
