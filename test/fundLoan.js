const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

function runFundLoanTests() {

  // Use a fixture to reduce code repetition
  async function deployCollateralizedLoanFixture() {

    // Create and deploy a fresh CollateralizedLoan contract
    const CollateralizedLoan = await ethers.getContractFactory("CollateralizedLoan");
    const collateralizedLoanContract = await CollateralizedLoan.deploy();

    // Create contract owner and consumers
    const [owner, borrower, lender] = await ethers.getSigners();

    return { collateralizedLoanContract, owner, borrower, lender };
  }

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
}

// Export the tests
module.exports = runFundLoanTests;