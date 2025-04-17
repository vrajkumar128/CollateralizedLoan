const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

// Use a fixture to reduce code repetition
async function deployCollateralizedLoanFixture() {

  // Create and deploy a fresh CollateralizedLoan contract
  const CollateralizedLoan = await ethers.getContractFactory("CollateralizedLoan");
  const collateralizedLoanContract = await CollateralizedLoan.deploy();

  // Create contract owner and consumers
  const [owner, borrower, lender] = await ethers.getSigners();

  return { collateralizedLoanContract, owner, borrower, lender };
}

function runRepayLoanTests() {

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
}

// Run the tests from just this file
runRepayLoanTests();

// Export the tests for testing in the main test script
module.exports = runRepayLoanTests;