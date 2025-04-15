const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

function runRequestLoanTests() {

  // Use a fixture to reduce code repetition
  async function deployCollateralizedLoanFixture() {

    // Create and deploy a fresh CollateralizedLoan contract
    const CollateralizedLoan = await ethers.getContractFactory("CollateralizedLoan");
    const collateralizedLoanContract = await CollateralizedLoan.deploy();

    // Create contract owner and consumers
    const [owner, borrower, lender] = await ethers.getSigners();

    return { collateralizedLoanContract, owner, borrower, lender };
  }

  // Test suite for the loan request functionality
  describe("Loan Request", function () {
    it("Should let a borrower deposit collateral and request a new loan", async function () {
      const { collateralizedLoanContract, borrower } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Have a borrower request a loan
      await collateralizedLoanContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Confirm the loan has been created with the specified arguments
      const loanId = 0;
      const loan = await collateralizedLoanContract.loans(loanId);
      expect(loan.collateralAmount).to.equal(collateralAmount);
      expect(loan.loanAmount).to.equal(loanAmount);
      expect(loan.interestRate).to.equal(interestRate);
      expect(loan.isFunded).to.equal(false);
      expect(loan.isRepaid).to.equal(false);
      expect(loan.isDefaulted).to.equal(false);
    });

    it("Should emit a LoanRequested event upon a successful loan request", async function () {
      const { collateralizedLoanContract, borrower } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;
      const block = await ethers.provider.getBlock("latest");
      const currentTimestamp = BigInt(block.timestamp);
      const dueDate = currentTimestamp + duration;

      // Check for emission of a LoanRequested event when a borrower requests a loan
      await expect(collateralizedLoanContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount }))
        .to.emit(collateralizedLoanContract, "LoanRequested")
        .withArgs(
          borrower.address,
          collateralAmount,
          loanAmount,
          interestRate,
          emittedDueDate => ((emittedDueDate - BigInt(dueDate)) <= BigInt(5)) // Allow 5 seconds of grace due to async operations
        )
    });

    it("Should not let a borrower request a duplicate loan", async function () {
      const { collateralizedLoanContract, borrower } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);

      // Save a contract instance with a borrower connected
      const borrowerContract = collateralizedLoanContract.connect(borrower);

      // Have the borrower request a loan
      await borrowerContract
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Attempt to have the borrower request the same loan again
      await expect(borrowerContract
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount }))
        .to.be.revertedWith(
          `Loan with these parameters has already been requested by borrower ${borrower.address.toLowerCase()}`
        );

      // Verify that only one loan was requested
      expect(await borrowerContract.nextLoanId()).to.equal(1);
    });

    it("Should not let a borrower request a loan with no collateral", async function () {
      const { collateralizedLoanContract, borrower } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(0);

      // Attempt to have a borrower request a loan with zero collateral
      await expect(collateralizedLoanContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount }))
        .to.be.revertedWith("Collateral amount must be greater than 0");

      // Verify that no loan requests have been made
      expect(await collateralizedLoanContract.nextLoanId()).to.equal(0);
    });
  });
}

// Export the tests
module.exports = runRequestLoanTests;