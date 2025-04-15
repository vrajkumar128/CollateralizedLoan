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
    )});

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

  // Test suite for funding a loan
  describe("Funding a Loan", function () {
    it("Should allow a lender to fund a loan", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
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

    it("Should emit a LoanFunded event upon a successful loan funding", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
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

      // Check for emission of a LoanFunded event when a lender funds the requested loan
      const loanId = 0;
      await expect(collateralizedLoanContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount }))
        .to.emit(collateralizedLoanContract, "LoanFunded")
        .withArgs(loanId);

      // Verify that the loan is marked as being funded
      const fundedLoan = await collateralizedLoanContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);
    });

    it("Should add the loan amount to the borrower's address upon a successful loan funding", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
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

      // Get the borrower's wallet balance before the loan is funded
      const borrowerBalanceBefore = await ethers.provider.getBalance(borrower.address);

      // Have a lender fund the loan
      const loanId = 0;
      await collateralizedLoanContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      const fundedLoan = await collateralizedLoanContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Get the borrower's wallet balance after the loan is funded
      const borrowerBalanceAfter = await ethers.provider.getBalance(borrower.address);

      // Calculate the difference in the borrower's balance before and after the loan is funded
      const balanceDifference = borrowerBalanceAfter - borrowerBalanceBefore;

      // Verify that the balance difference is equal to the loan amount
      expect(balanceDifference).to.equal(loanAmount);
    });

    it("Should subtract the loan amount (plus gas costs) from the lender's address upon a successful loan funding", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
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

      // Get the lenders's wallet balance before the loan is funded
      const lenderBalanceBefore = await ethers.provider.getBalance(lender.address);

      // Have a lender fund the loan
      const loanId = 0;
      const fundTx = await collateralizedLoanContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      const fundedLoan = await collateralizedLoanContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Get the transaction receipt to determine gas costs
      const receipt = await fundTx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      // Get the lender's wallet balance after the loan is funded
      const lenderBalanceAfter = await ethers.provider.getBalance(lender.address);

      // Calculate the difference in the lender's balance (including gas costs) before and after the loan is funded
      const expectedDifference = loanAmount + gasCost;
      const actualDifference = lenderBalanceBefore - lenderBalanceAfter;

      // Verify that the balance difference is equal to the loan amount plus gas fees
      expect(actualDifference).to.equal(expectedDifference);
    });

    it("Should not allow a lender to fund a loan that does not exist", async function () {
      const { collateralizedLoanContract, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan amount
      const loanAmount = BigInt(3);

      // Attempt to have a lender fund a loan that has not been requested
      const loanId = 0;
      expect(collateralizedLoanContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount }))
        .to.be.revertedWith("Loan does not exist");
    });

    it("Should not allow a lender to fund a loan that has already been funded", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
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

      // Save a contract instance with the lender connected
      const lenderContract = collateralizedLoanContract.connect(lender);

      // Have a lender fund the loan
      const loanId = 0;
      await lenderContract
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      let fundedLoan = await lenderContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Attempt to fund the loan again
      expect(lenderContract
        .fundLoan(loanId, { value: loanAmount }))
        .to.be.revertedWith(`Requested loan has already been funded by lender ${lender.address.toLowerCase()}`);

      // Confirm that attempting to fund the loan again did not inadvertently change its status
      fundedLoan = await lenderContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);
    });

    it("Should not allow a lender to fund a loan with the incorrect funding amount", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const incorrectLoanAmount = BigInt(4);

      // Have a borrower request a loan
      await collateralizedLoanContract
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Attempt to have a lender fund the loan with the incorrect amount
      const loanId = 0;
      await expect(collateralizedLoanContract
        .connect(lender)
        .fundLoan(loanId, { value: incorrectLoanAmount }))
        .to.be.revertedWith("Incorrect funding amount");

      // Verify that the loan has not been marked as being funded
      const loan = await collateralizedLoanContract.loans(loanId);
      expect(loan.isFunded).to.equal(false);
    });

    it("Should not allow a lender to fund a loan that has expired", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
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

      // Fast forward time past the loan's due date
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 100]); // Add 100 seconds to be sure
      await ethers.provider.send("evm_mine"); // Mine a new block to apply the time change

      // Attempt to have a lender fund the loan
      const loanId = 0;
      await expect(collateralizedLoanContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount }))
        .to.be.revertedWith("Loan has expired");

      // Verify that the loan has not been marked as being funded
      const loan = await collateralizedLoanContract.loans(loanId);
      expect(loan.isFunded).to.equal(false);
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
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with a borrower connected
      const borrowerContract = collateralizedLoanContract.connect(borrower);

      // Have the borrower request a loan
      await borrowerContract
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have a lender fund the loan
      const loanId = 0;
      await borrowerContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      const fundedLoan = await borrowerContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Use interest rate to calculate loan repayment amouont
      const repaymentAmount = fundedLoan.loanAmount + ((fundedLoan.loanAmount * BigInt(fundedLoan.interestRate)) / BigInt(100));
      
      // Have the borrower repay the loan
      await borrowerContract
        .repayLoan(loanId, { value: repaymentAmount });

      // Confirm that the loan has been marked as repaid
      const repaidLoan = await borrowerContract.loans(loanId);
      expect(repaidLoan.isRepaid).to.equal(true);
    });

    it("Should emit a LoanRepaid event upon a successful loan repayment", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with a borrower connected
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

      // Verify that the loan is marked as being funded
      const fundedLoan = await borrowerContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Use interest rate to calculate loan repayment amouont
      const repaymentAmount = fundedLoan.loanAmount + ((fundedLoan.loanAmount * BigInt(fundedLoan.interestRate)) / BigInt(100));

      // Check for emission of a LoanRepaid event when the borrower repays the loan
      await expect(borrowerContract
        .repayLoan(loanId, { value: repaymentAmount }))
        .to.emit(borrowerContract, "LoanRepaid")
        .withArgs(loanId);

      // Confirm that the loan has been marked as repaid
      const repaidLoan = await borrowerContract.loans(loanId);
      expect(repaidLoan.isRepaid).to.equal(true);
    });

    it("Should add the repayment amount to the lender's address upon a successful loan repayment", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with a borrower connected
      const borrowerContract = collateralizedLoanContract.connect(borrower);

      // Have the borrower request a loan
      await borrowerContract
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have a lender fund the loan
      const loanId = 0;
      await borrowerContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      const fundedLoan = await borrowerContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Use interest rate to calculate loan repayment amouont
      const repaymentAmount = fundedLoan.loanAmount + ((fundedLoan.loanAmount * BigInt(fundedLoan.interestRate)) / BigInt(100));

      // Get the lender's wallet balance before the loan is repaid
      const lenderBalanceBefore = await ethers.provider.getBalance(lender.address);

      // Have the borrower repay the loan
      await borrowerContract
        .repayLoan(loanId, { value: repaymentAmount });

      // Confirm that the loan has been marked as repaid
      const repaidLoan = await borrowerContract.loans(loanId);
      expect(repaidLoan.isRepaid).to.equal(true);

      // Get the lender's wallet balance after the loan is repaid
      const lenderBalanceAfter = await ethers.provider.getBalance(lender.address);

      // Calculate the difference in the lender's balance before and after the loan is repaid
      const balanceDifference = lenderBalanceAfter - lenderBalanceBefore;

      // Verify that the balance difference is equal to the loan amount
      expect(balanceDifference).to.equal(repaymentAmount);
    });

    // This test is actually the same as the next one -- I only duplicated them for clarity's sake when looking at the testing output
    it("Should subtract the repayment amount (plus gas costs) from the borrower's address upon a successful loan repayment", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with a borrower connected
      const borrowerContract = collateralizedLoanContract.connect(borrower);

      // Have the borrower request a loan
      await borrowerContract.depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have a lender fund the loan
      const loanId = 0;
      await collateralizedLoanContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      const fundedLoan = await borrowerContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Use interest rate to calculate loan repayment amouont
      const repaymentAmount = fundedLoan.loanAmount + ((fundedLoan.loanAmount * BigInt(fundedLoan.interestRate)) / BigInt(100));

      // Get the borrower's wallet balance before the loan is repaid
      const borrowerBalanceBefore = await ethers.provider.getBalance(borrower.address);

      // Have the borrower repay the loan
      const repayTx = await borrowerContract
        .repayLoan(loanId, { value: repaymentAmount });

      // Confirm that the loan has been marked as repaid
      const repaidLoan = await borrowerContract.loans(loanId);
      expect(repaidLoan.isRepaid).to.equal(true);
      
      // Get the transaction receipt to determine gas costs
      const receipt = await repayTx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      // Get the borrower's wallet balance after the loan is repaid
      const borrowerBalanceAfter = await ethers.provider.getBalance(borrower.address);

      // Calculate the difference in the borrower's balance (including gas costs and collateral) before and after the loan is repaid
      const expectedDifference = repaymentAmount + gasCost - collateralAmount;
      const actualDifference = borrowerBalanceBefore - borrowerBalanceAfter;

      // Verify that the balance difference is equal to the loan amount plus gas fees and minus collateral
      expect(actualDifference).to.equal(expectedDifference);
    });

    // This test is the same as the previous one
    it("Should return the collateral to the borrower's address upon a successful loan repayment", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with a borrower connected
      const borrowerContract = collateralizedLoanContract.connect(borrower);

      // Have the borrower request a loan
      await borrowerContract.depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have a lender fund the loan
      const loanId = 0;
      await collateralizedLoanContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      const fundedLoan = await borrowerContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Use interest rate to calculate loan repayment amouont
      const repaymentAmount = fundedLoan.loanAmount + ((fundedLoan.loanAmount * BigInt(fundedLoan.interestRate)) / BigInt(100));

      // Get the borrower's wallet balance before the loan is repaid
      const borrowerBalanceBefore = await ethers.provider.getBalance(borrower.address);

      // Have the borrower repay the loan
      const repayTx = await borrowerContract
        .repayLoan(loanId, { value: repaymentAmount });

      // Confirm that the loan has been marked as repaid
      const repaidLoan = await borrowerContract.loans(loanId);
      expect(repaidLoan.isRepaid).to.equal(true);

      // Get the transaction receipt to determine gas costs
      const receipt = await repayTx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      // Get the borrower's wallet balance after the loan is repaid
      const borrowerBalanceAfter = await ethers.provider.getBalance(borrower.address);

      // Calculate the difference in the borrower's balance (including gas costs and collateral) before and after the loan is repaid
      const expectedDifference = repaymentAmount + gasCost - collateralAmount;
      const actualDifference = borrowerBalanceBefore - borrowerBalanceAfter;

      // Verify that the balance difference is equal to the loan amount plus gas fees and minus collateral
      expect(actualDifference).to.equal(expectedDifference);
    });

    it("Should not allow a borrower to repay a loan that does not exist", async function () {
      const { collateralizedLoanContract, borrower } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const loanAmount = BigInt(2);

      // Use interest rate to calculate loan repayment amouont
      const repaymentAmount = loanAmount + ((loanAmount * BigInt(interestRate)) / BigInt(100));

      // Attempt to have a borrower repay a loan that has not been requested
      const loanId = 0;
      expect(collateralizedLoanContract
        .connect(borrower)
        .repayLoan(loanId, { value: repaymentAmount }))
        .to.be.revertedWith("Loan does not exist");
    });

    // For practical reasons this test is not truly exhaustive -- it tests only 19 non-borrower addresses
    it("Should not allow anyone but the borrower of the loan to repay the loan", async function () {
      const accounts = await ethers.getSigners(); // Supplies 20 test accounts (including the borrower)
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with a borrower connected
      const borrowerContract = collateralizedLoanContract.connect(borrower);

      // Have the borrower request a loan
      await borrowerContract
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have a lender fund the loan
      const loanId = 0;
      await borrowerContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      const fundedLoan = await borrowerContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Use interest rate to calculate loan repayment amouont
      const repaymentAmount = fundedLoan.loanAmount + ((fundedLoan.loanAmount * BigInt(fundedLoan.interestRate)) / BigInt(100));

      // Try to repay the loan with non-borrower accounts
      for (const account of accounts) {
        if (account.address !== borrower.address) {
          await expect(
            borrowerContract
              .connect(account)
              .repayLoan(loanId, { value: repaymentAmount }))
              .to.be.revertedWith("Only the borrower can repay this loan");
        }
      }

      // Confirm that the actual borrower can still repay successfully
      await borrowerContract
        .repayLoan(loanId, { value: repaymentAmount });

      // Confirm that the loan has been marked as repaid
      const repaidLoan = await collateralizedLoanContract.loans(loanId);
      expect(repaidLoan.isRepaid).to.equal(true);
    });

    it("Should not allow a borrower to repay a loan that has not been funded", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with a borrower connected
      const borrowerContract = collateralizedLoanContract.connect(borrower);

      // Have the borrower request a loan
      await borrowerContract
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Use interest rate to calculate loan repayment amouont
      const loanId = 0;
      const loan = await borrowerContract.loans(loanId);
      const repaymentAmount = loanAmount + ((loanAmount * BigInt(interestRate)) / BigInt(100));

      // Attempt to have the borrower repay the loan
      expect(borrowerContract
        .repayLoan(loanId, { value: repaymentAmount }))
        .to.be.revertedWith("Loan has not yet been funded");

      // Confirm that the loan has been marked as neither funded nor repaid
      expect(loan.isFunded).to.equal(false);
      expect(loan.isRepaid).to.equal(false);
    });

    it("Should not allow a borrower to repay a loan that has expired", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with a borrower connected
      const borrowerContract = collateralizedLoanContract.connect(borrower);

      // Have the borrower request a loan
      await borrowerContract
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have a lender fund the loan
      const loanId = 0;
      await borrowerContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      const fundedLoan = await borrowerContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Use interest rate to calculate loan repayment amouont
      const repaymentAmount = fundedLoan.loanAmount + ((fundedLoan.loanAmount * BigInt(fundedLoan.interestRate)) / BigInt(100));

      // Fast forward time past the loan's due date
      await ethers.provider.send("evm_increaseTime", [Number(duration) + 100]); // Add 100 seconds to be sure
      await ethers.provider.send("evm_mine"); // Mine a new block to apply the time change

      // Attempt to have the borrower repay the loan
      await expect(borrowerContract
        .repayLoan(loanId, { value: repaymentAmount }))
        .to.be.revertedWith("Loan has expired and cannot be repaid");

      // Verify that the loan has not been marked as being repaid
      const defaultedLoan = await borrowerContract.loans(loanId);
      expect(defaultedLoan.isRepaid).to.equal(false);
    });

    it("Should not allow a borrower to repay a loan that has already been repaid", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with a borrower connected
      const borrowerContract = collateralizedLoanContract.connect(borrower);

      // Have the borrower request a loan
      await borrowerContract
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have a lender fund the loan
      const loanId = 0;
      await borrowerContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      const fundedLoan = await borrowerContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Use interest rate to calculate loan repayment amouont
      const repaymentAmount = fundedLoan.loanAmount + ((fundedLoan.loanAmount * BigInt(fundedLoan.interestRate)) / BigInt(100));

      // Have the borrower repay the loan
      await borrowerContract
        .repayLoan(loanId, { value: repaymentAmount });

      // Confirm that the loan has been marked as repaid
      let repaidLoan = await borrowerContract.loans(loanId);
      expect(repaidLoan.isRepaid).to.equal(true);

      // Attempt to have the borrower repay the loan again
      await expect(borrowerContract
        .repayLoan(loanId, { value: repaymentAmount }))
        .to.be.revertedWith("Loan has already been repaid");

      // Confirm that the loan is still marked as being repaid
      repaidLoan = await borrowerContract.loans(loanId);
      expect(repaidLoan.isRepaid).to.equal(true);
    });

    it("Should not allow a borrower to repay a loan with the incorrect repayment amount (either underpaying or overpaying)", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(60);
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Save a contract instance with a borrower connected
      const borrowerContract = collateralizedLoanContract.connect(borrower);

      // Have the borrower request a loan
      await borrowerContract
        .depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Have a lender fund the loan
      const loanId = 0;
      await borrowerContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as being funded
      let fundedLoan = await borrowerContract.loans(loanId);
      expect(fundedLoan.isFunded).to.equal(true);

      // Use interest rate to calculate correct loan repayment amount
      const repaymentAmount = fundedLoan.loanAmount + ((fundedLoan.loanAmount * BigInt(fundedLoan.interestRate)) / BigInt(100));

      // Deviate from the correct repayment amount in the positive direction (overpaying)
      const incorrectRepaymentAmount1 = repaymentAmount + BigInt(1);

      // Attempt to have the borrower repay the loan with the first incorrect repayment amount
      await expect(borrowerContract
        .repayLoan(loanId, { value: incorrectRepaymentAmount1 }))
        .to.be.revertedWith("Incorrect repayment amount");

      // Confirm that the loan has not been marked as being repaid
      fundedLoan = await borrowerContract.loans(loanId);
      expect(fundedLoan.isRepaid).to.equal(false);

      // Deviate from the correct repayment amount in the negative direction (underpaying)
      const incorrectRepaymentAmount2 = repaymentAmount - BigInt(1);

      // Attempt to have the borrower repay the loan with the second incorrect repayment amount
      await expect(borrowerContract
        .repayLoan(loanId, { value: incorrectRepaymentAmount2 }))
        .to.be.revertedWith("Incorrect repayment amount");

      // Confirm that the loan has not been marked as being repaid
      fundedLoan = await borrowerContract.loans(loanId);
      expect(fundedLoan.isRepaid).to.equal(false);
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
  });
});
