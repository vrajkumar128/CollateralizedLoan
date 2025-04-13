// Importing necessary modules and functions from Hardhat and Chai for testing
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect, assert } = require("chai");
const { ethers } = require("hardhat");

// Test suite for the ColleratalizedLoan contract
describe("CollateralizedLoan", function () {

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
    it("Should let a borrower deposit collateral and request a loan", async function () {
      const { collateralizedLoanContract, borrower } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(2);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Have a borrower request a loan
      await collateralizedLoanContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Confirm the loan has been created with the specified arguments
      const loanId = 0;
      const fundedLoan = await collateralizedLoanContract.loans(loanId);
      expect(fundedLoan.collateralAmount).to.equal(collateralAmount);
      expect(fundedLoan.loanAmount).to.equal(loanAmount);
      expect(fundedLoan.interestRate).to.equal(interestRate);
      expect(fundedLoan.isFunded).to.equal(false);
      expect(fundedLoan.isRepaid).to.equal(false);
      expect(fundedLoan.isDefaulted).to.equal(false);
    });

    it("Should emit a LoanRequested event", async function () {
      const { collateralizedLoanContract, borrower } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(2);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;
      const block = await ethers.provider.getBlock("latest");
      const currentTimestamp = BigInt(block.timestamp);
      const dueDate = currentTimestamp + duration;

      // Tie the contract deployment to a specific borrower address
      const borrowerContract = collateralizedLoanContract.connect(borrower);

      // Check for emission of a LoanRequested event when a borrower requests a loan
      await expect(borrowerContract.depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount }))
        .to.emit(collateralizedLoanContract, "LoanRequested")
        .withArgs(borrower.address, 
          collateralAmount, 
          loanAmount, 
          interestRate, 
          emittedDueDate => ((emittedDueDate - BigInt(dueDate)) <= BigInt(5))) // Allow 5 seconds of grace due to async operations
    });
  });

  // Test suite for funding a loan
  describe("Funding a Loan", function () {
    it("Should allow a lender to fund a loan", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(2);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Have a borrower request a loan
      await collateralizedLoanContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have a lender fund the loan
      const loanId = 0;
      await collateralizedLoanContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });
      
      // Confirm that the loan is now funded
      const fundedLoan = await collateralizedLoanContract.loans(loanId);
      expect(fundedLoan.collateralAmount).to.equal(collateralAmount);
      expect(fundedLoan.loanAmount).to.equal(loanAmount);
      expect(fundedLoan.interestRate).to.equal(interestRate);
      expect(fundedLoan.isFunded).to.equal(true); // THIS SHOULD NOW BE TRUE
      expect(fundedLoan.isRepaid).to.equal(false);
      expect(fundedLoan.isDefaulted).to.equal(false);
    });

    it("Should emit a LoanFunded event", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(2);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Have a borrower request a loan
      await collateralizedLoanContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Check for emission of a LoanFunded event when a lender funds the requested loan
      const loanId = 0;
      await expect(collateralizedLoanContract.fundLoan(loanId, { value: loanAmount }))
        .to.emit(collateralizedLoanContract, "LoanFunded")
        .withArgs(loanId);
    });
  });

  // Test suite for repaying a loan
  describe("Repaying a Loan", function () {
    it("Should enable the borrower to repay the loan fully", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(2);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Tie the contract deployment to a specific borrower address
      const borrowerContract = collateralizedLoanContract.connect(borrower);

      // Have the borrower request a loan
      await borrowerContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have a lender fund the loan
      const loanId = 0;
      await borrowerContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Use interest rate to calculate loan repayment amouont
      const loan = await borrowerContract.loans(loanId);
      const repaymentAmount = loan.loanAmount + ((loan.loanAmount * BigInt(loan.interestRate)) / BigInt(100));
      
      // Have the borrower repay the loan
      await borrowerContract.repayLoan(loanId, { value: repaymentAmount });

      // Confirm that the loan has been marked as repaid
      const fundedLoan = await borrowerContract.loans(loanId);
      expect(fundedLoan.collateralAmount).to.equal(collateralAmount);
      expect(fundedLoan.loanAmount).to.equal(loanAmount);
      expect(fundedLoan.interestRate).to.equal(interestRate);
      expect(fundedLoan.isFunded).to.equal(true);
      expect(fundedLoan.isRepaid).to.equal(true); // THIS SHOULD NOW BE TRUE
      expect(fundedLoan.isDefaulted).to.equal(false);
    });

    it("Should emit a LoanRepaid event", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(2);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Tie the contract deployment to a specific borrower address
      const borrowerContract = collateralizedLoanContract.connect(borrower);

      // Have the borrower request a loan
      await borrowerContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have a lender fund the loan
      const loanId = 0;
      await borrowerContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Use interest rate to calculate loan repayment amouont
      const loan = await borrowerContract.loans(loanId);
      const repaymentAmount = loan.loanAmount + ((loan.loanAmount * BigInt(loan.interestRate)) / BigInt(100));

      // Check for emission of a LoanRepaid event when the borrower repays the loan
      await expect(borrowerContract.repayLoan(loanId, { value: repaymentAmount }))
        .to.emit(borrowerContract, "LoanRepaid")
        .withArgs(loanId);
    });
  });

  // Test suite for claiming collateral
  describe("Claiming Collateral", function () {
    it("Should permit the lender to claim collateral if the loan isn't repaid on time", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(2);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Tie the contract deployment to a specific lender address
      const lenderContract = collateralizedLoanContract.connect(lender);

      // Have a borrower request a loan
      await lenderContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have the lender fund the loan
      const loanId = 0;
      await lenderContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Fast forward time past the loan's due date
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 100]); // Add 100 seconds to be sure
      await ethers.provider.send("evm_mine"); // Mine a new block to apply the time change

      // Have the lender claim the loan's collateral
      await lenderContract.claimCollateral(loanId);

      // Confirm the loan is now in default
      const defaultedLoan = await collateralizedLoanContract.loans(loanId);
      expect(defaultedLoan.collateralAmount).to.equal(collateralAmount);
      expect(defaultedLoan.loanAmount).to.equal(loanAmount);
      expect(defaultedLoan.interestRate).to.equal(interestRate);
      expect(defaultedLoan.isFunded).to.equal(true);
      expect(defaultedLoan.isRepaid).to.equal(false); // THIS SHOULD BE FALSE
      expect(defaultedLoan.isDefaulted).to.equal(true); // THIS SHOULD NOW BE TRUE
    });

    it("Should emit a CollateralClaimed event", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(2);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Tie the contract deployment to a specific lender address
      const lenderContract = collateralizedLoanContract.connect(lender);

      // Have a borrower request a loan
      await lenderContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have the lender fund the loan
      const loanId = 0;
      await lenderContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Fast forward time past the loan's due date
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 100]); // Add 100 seconds to be sure
      await ethers.provider.send("evm_mine"); // Mine a new block to apply the time change

      // Check for emission of a CollateralClaimed event when the lender claims the collateral
      await expect(lenderContract.claimCollateral(loanId))
        .to.emit(lenderContract, "CollateralClaimed")
        .withArgs(borrower.address, lender.address, collateralAmount);
    });
  });
});
