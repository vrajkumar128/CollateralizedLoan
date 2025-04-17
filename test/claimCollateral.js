const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

function runClaimCollateralTests() {

  // Use a fixture to reduce code repetition
  async function deployCollateralizedLoanFixture() {

    // Create and deploy a fresh CollateralizedLoan contract
    const CollateralizedLoan = await ethers.getContractFactory("CollateralizedLoan");
    const collateralizedLoanContract = await CollateralizedLoan.deploy();

    // Create contract owner and consumers
    const [owner, borrower, lender] = await ethers.getSigners();

    return { collateralizedLoanContract, owner, borrower, lender };
  }

  // Test suite for claiming collateral
  describe("Claiming Collateral", function () {
    it("Should permit the lender to claim collateral if the loan isn't repaid on time", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with the lender connected
      const lenderContract = collateralizedLoanContract.connect(lender);

      // Have a borrower request a loan
      await lenderContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have the lender fund the loan
      const loanId = 0;
      await lenderContract
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      let fundedLoan = await lenderContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Fast forward time past the loan's due date
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 100]); // Add 100 seconds to be sure
      await ethers.provider.send("evm_mine"); // Mine a new block to apply the time change

      // Have the lender claim the loan's collateral
      await lenderContract.claimCollateral(loanId);

      // Confirm the loan is now in default
      const defaultedLoan = await lenderContract.loans(loanId);
      expect(defaultedLoan.isRepaid).to.equal(false);
      expect(defaultedLoan.isDefaulted).to.equal(true)
    });

    it("Should emit a CollateralClaimed event upon a successful collateral claim", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with the lender connected
      const lenderContract = collateralizedLoanContract.connect(lender);

      // Have a borrower request a loan
      await lenderContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have the lender fund the loan
      const loanId = 0;
      await lenderContract
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      let fundedLoan = await lenderContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Fast forward time past the loan's due date
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 100]); // Add 100 seconds to be sure
      await ethers.provider.send("evm_mine"); // Mine a new block to apply the time change

      // Check for emission of a CollateralClaimed event when the lender claims the collateral
      await expect(lenderContract.claimCollateral(loanId))
        .to.emit(lenderContract, "CollateralClaimed")
        .withArgs(borrower.address, lender.address, collateralAmount);

      // Confirm the loan is now in default
      const defaultedLoan = await lenderContract.loans(loanId);
      expect(defaultedLoan.isRepaid).to.equal(false);
      expect(defaultedLoan.isDefaulted).to.equal(true);
    });

    it("Should add the collateral amount (minus gas costs) to the lender's address upon claiming the collateral", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with the lender connected
      const lenderContract = collateralizedLoanContract.connect(lender);

      // Have a borrower request a loan
      await lenderContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have the lender fund the loan
      const loanId = 0;
      await lenderContract
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      let fundedLoan = await lenderContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Fast forward time past the loan's due date
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 100]); // Add 100 seconds to be sure
      await ethers.provider.send("evm_mine"); // Mine a new block to apply the time change

      // Get the lenders's wallet balance before the collateral is claimed
      const lenderBalanceBefore = await ethers.provider.getBalance(lender.address);

      // Have the lender claim the loan's collateral
      const claimTx = await lenderContract.claimCollateral(loanId);

      // Get the transaction receipt to determine gas costs
      const receipt = await claimTx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      // Get the lender's wallet balance after the collateral is claimed
      const lenderBalanceAfter = await ethers.provider.getBalance(lender.address);

      // Calculate the difference in the lender's balance (including gas costs) before and after the collateral is claimed
      const expectedDifference = collateralAmount - gasCost;
      const actualDifference = lenderBalanceAfter - lenderBalanceBefore;

      // Verify that the balance difference is equal to the loan amount plus gas fees and minus collateral
      expect(actualDifference).to.equal(expectedDifference);

      // Confirm that the loan is now in default
      const defaultedLoan = await lenderContract.loans(loanId);
      expect(defaultedLoan.isRepaid).to.equal(false);
      expect(defaultedLoan.isDefaulted).to.equal(true);
    });

    it("Should not allow a lender to claim collateral from a loan that does not exist", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Attempt to have a lender claim collateral from a loan that has not been requested
      const loanId = 0;
      expect(collateralizedLoanContract.connect(lender)
        .claimCollateral(loanId))
        .to.be.revertedWith("Loan does not exist");
    });

    // For practical reasons this test is not truly exhaustive -- it tests only 19 non-lender addresses
    it("Should not allow anyone but the lender of the loan to claim the collateral", async function () {
      const accounts = await ethers.getSigners(); // Supplies 20 test accounts (including the lender)
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with the lender connected
      const lenderContract = collateralizedLoanContract.connect(lender);

      // Have a borrower request a loan
      await lenderContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have the lender fund the loan
      const loanId = 0;
      await lenderContract
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      let fundedLoan = await lenderContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Fast forward time past the loan's due date
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 100]); // Add 100 seconds to be sure
      await ethers.provider.send("evm_mine"); // Mine a new block to apply the time change

      // Try to claim the collateral with non-lender accounts
      for (const account of accounts) {
        if (account.address !== lender.address) {
          await expect(
            lenderContract
              .connect(account)
              .claimCollateral(loanId))
            .to.be.revertedWith("Only the lender can claim the collateral of this loan");
        }
      }

      // Confirm that the actual lender can still claim the collateral
      await lenderContract.claimCollateral(loanId);

      // Confirm the loan is now in default
      const defaultedLoan = await lenderContract.loans(loanId);
      expect(defaultedLoan.isRepaid).to.equal(false);
      expect(defaultedLoan.isDefaulted).to.equal(true)
    });

    it("Should not allow a lender to claim collateral from a loan that has not yet been funded", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);

      // Save a contract instance with the lender connected
      const lenderContract = collateralizedLoanContract.connect(lender);

      // Have a borrower request a loan
      await lenderContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Fast forward time past the loan's due date
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 100]); // Add 100 seconds to be sure
      await ethers.provider.send("evm_mine"); // Mine a new block to apply the time change

      // Verify that the loan is not marked as being funded
      const loanId = 0;
      let loan = await lenderContract.loans(loanId);
      expect(loan.isFunded).to.equal(false);

      // Attempt to have a lender claim collateral from a loan that has not been funded
      expect(lenderContract
        .claimCollateral(loanId))
        .to.be.revertedWith("Loan has not yet been funded");

      // Confirm that the loan is *not* in default
      const defaultedLoan = await lenderContract.loans(loanId);
      expect(defaultedLoan.isRepaid).to.equal(false);
      expect(defaultedLoan.isDefaulted).to.equal(false);
    });

    it("Should not allow a lender to claim collateral from a loan that was repaid in time", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with the lender connected
      const lenderContract = collateralizedLoanContract.connect(lender);

      // Have a borrower request a loan
      await lenderContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have the lender fund the loan
      const loanId = 0;
      await lenderContract
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      let fundedLoan = await lenderContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Use interest rate to calculate loan repayment amouont
      const repaymentAmount = fundedLoan.loanAmount + ((fundedLoan.loanAmount * BigInt(fundedLoan.interestRate)) / BigInt(100));

      // Have the borrower repay the loan
      await lenderContract
        .connect(borrower)
        .repayLoan(loanId, { value: repaymentAmount });

      // Confirm that the loan has been marked as repaid
      const repaidLoan = await lenderContract.loans(loanId);
      expect(repaidLoan.isRepaid).to.equal(true);

      // Fast forward time past the loan's due date
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 100]); // Add 100 seconds to be sure
      await ethers.provider.send("evm_mine"); // Mine a new block to apply the time change

      // Attempt to have the lender claim collateral from a loan that was was repaid on time
      expect(lenderContract
        .claimCollateral(loanId))
        .to.be.revertedWith("Loan was repaid on time");

      // Confirm that the loan is *not* in default
      const defaultedLoan = await lenderContract.loans(loanId);
      expect(defaultedLoan.isDefaulted).to.equal(false);
    });

    it("Should not allow a lender to claim collateral from an outstanding loan that has not yet expired", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with the lender connected
      const lenderContract = collateralizedLoanContract.connect(lender);

      // Have a borrower request a loan
      await lenderContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have the lender fund the loan
      const loanId = 0;
      await lenderContract
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      let fundedLoan = await lenderContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Attempt to have the lender claim collateral from an outstanding loan that has not yet expired
      expect(lenderContract
        .claimCollateral(loanId))
        .to.be.revertedWith("Loan is not yet past due date");

      // Confirm that the loan is *not* in default
      const defaultedLoan = await lenderContract.loans(loanId);
      expect(defaultedLoan.isRepaid).to.equal(false);
      expect(defaultedLoan.isDefaulted).to.equal(false);
    });

    it("Should not allow a lender to claim collateral from a loan that the collateral has already been claimed from", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with the lender connected
      const lenderContract = collateralizedLoanContract.connect(lender);

      // Have a borrower request a loan
      await lenderContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have the lender fund the loan
      const loanId = 0;
      await lenderContract
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      let fundedLoan = await lenderContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Fast forward time past the loan's due date
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 100]); // Add 100 seconds to be sure
      await ethers.provider.send("evm_mine"); // Mine a new block to apply the time change

      // Have the lender claim the loan's collateral
      lenderContract.claimCollateral(loanId);

      // Confirm that the loan is now in default
      const defaultedLoan = await lenderContract.loans(loanId);
      expect(defaultedLoan.isRepaid).to.equal(false);
      expect(defaultedLoan.isDefaulted).to.equal(false);

      // Attempt to have the lender claim the loan's collateral again
      expect(lenderContract
        .claimCollateral(loanId))
        .to.be.revertedWith("Collateral has already been claimed");
    });
  });
}

// Export the tests
module.exports = runClaimCollateralTests;