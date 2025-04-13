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

    it("Should emit a LoanRequested event upon a successful loan request", async function () {
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
      const duration = BigInt(2);
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
      const duration = BigInt(2);
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

    it("Should emit a LoanFunded event upon a successful loan funding", async function () {
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
      await expect(collateralizedLoanContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount }))
        .to.emit(collateralizedLoanContract, "LoanFunded")
        .withArgs(loanId);
    });

    it("Should add the loan amount to the borrower's address upon a successful loan funding", async function () {
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

      // Get the borrower's wallet balance before the loan is funded
      const borrowerBalanceBefore = await ethers.provider.getBalance(borrower.address);

      // Have a lender fund the loan
      const loanId = 0;
      await collateralizedLoanContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Verify that the loan is marked as funded
      const loan = await collateralizedLoanContract.loans(loanId);
      expect(loan.isFunded).to.equal(true);

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
      const duration = BigInt(2);
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

      // Verify that the loan is marked as funded
      const loan = await collateralizedLoanContract.loans(loanId);
      expect(loan.isFunded).to.equal(true);

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

    it("Should not allow a lender to fund a loan that has not been requested", async function () {
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
      expect(fundedLoan.isFunded).to.equal(true);

      // Attempt to fund the loan again
      expect(collateralizedLoanContract.connect(lender)
        .fundLoan(loanId, { value: loanAmount }))
        .to.be.revertedWith(`Requested loan has already been funded by lender ${lender.address.toLowerCase()}`);

      // Confirm that attempting to fund the loan again did not inadvertently change its status
      expect(fundedLoan.isFunded).to.equal(true);
    });

    it("Should not allow a lender to fund a loan with the incorrect funding amount", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(2);
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
      const duration = BigInt(2);
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
      const duration = BigInt(2);
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

      // Use interest rate to calculate loan repayment amouont
      const loan = await collateralizedLoanContract.loans(loanId);
      const repaymentAmount = loan.loanAmount + ((loan.loanAmount * BigInt(loan.interestRate)) / BigInt(100));
      
      // Have the borrower repay the loan
      await borrowerContract
        .repayLoan(loanId, { value: repaymentAmount });

      // Confirm that the loan has been marked as repaid
      const fundedLoan = await borrowerContract.loans(loanId);
      expect(fundedLoan.collateralAmount).to.equal(collateralAmount);
      expect(fundedLoan.loanAmount).to.equal(loanAmount);
      expect(fundedLoan.interestRate).to.equal(interestRate);
      expect(fundedLoan.isFunded).to.equal(true);
      expect(fundedLoan.isRepaid).to.equal(true); // THIS SHOULD NOW BE TRUE
      expect(fundedLoan.isDefaulted).to.equal(false);
    });

    it("Should emit a LoanRepaid event upon a successful loan repayment", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(2);
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

      // Use interest rate to calculate loan repayment amouont
      const loan = await collateralizedLoanContract.loans(loanId);
      const repaymentAmount = loan.loanAmount + ((loan.loanAmount * BigInt(loan.interestRate)) / BigInt(100));

      // Check for emission of a LoanRepaid event when the borrower repays the loan
      await expect(borrowerContract
        .repayLoan(loanId, { value: repaymentAmount }))
        .to.emit(collateralizedLoanContract, "LoanRepaid")
        .withArgs(loanId);
    });

    it("Should add the repayment amount to the lender's address upon a successful loan repayment", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(2);
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

      // Use interest rate to calculate loan repayment amouont
      const loan = await borrowerContract.loans(loanId);
      const repaymentAmount = loan.loanAmount + ((loan.loanAmount * BigInt(loan.interestRate)) / BigInt(100));

      // Get the lender's wallet balance before the loan is repaid
      const lenderBalanceBefore = await ethers.provider.getBalance(lender.address);

      // Have the borrower repay the loan
      await borrowerContract
        .repayLoan(loanId, { value: repaymentAmount });

      // Get the lender's wallet balance after the loan is repaid
      const lenderBalanceAfter = await ethers.provider.getBalance(lender.address);

      // Calculate the difference in the lender's balance before and after the loan is repaid
      const balanceDifference = lenderBalanceAfter - lenderBalanceBefore;

      // Verify that the balance difference is equal to the loan amount
      expect(balanceDifference).to.equal(repaymentAmount);
    });

    it("Should subtract the repayment amount (plus gas costs) from and return the collateral to the borrower's address upon a successful loan repayment", async function () {
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const interestRate = BigInt(1);
      const duration = BigInt(2);
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

      // Use interest rate to calculate loan repayment amouont
      const loan = await borrowerContract.loans(loanId);
      const repaymentAmount = loan.loanAmount + ((loan.loanAmount * BigInt(loan.interestRate)) / BigInt(100));

      // Get the borrower's wallet balance before the loan is repaid
      const borrowerBalanceBefore = await ethers.provider.getBalance(borrower.address);

      // Have the borrower repay the loan
      const repayTx = await borrowerContract
        .repayLoan(loanId, { value: repaymentAmount });
      
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

    it("Should not allow a borrower to repay a loan that has not been requested", async function () {
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
      const duration = BigInt(2);
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

      // Use interest rate to calculate loan repayment amouont
      const loan = await collateralizedLoanContract.loans(loanId);
      const repaymentAmount = loan.loanAmount + ((loan.loanAmount * BigInt(loan.interestRate)) / BigInt(100));

      assert.fail();

      // // Have the borrower repay the loan
      // await borrowerContract
      //   .repayLoan(loanId, { value: repaymentAmount });

      // // Confirm that the loan has been marked as repaid
      // const fundedLoan = await borrowerContract.loans(loanId);
      // expect(fundedLoan.collateralAmount).to.equal(collateralAmount);
      // expect(fundedLoan.loanAmount).to.equal(loanAmount);
      // expect(fundedLoan.interestRate).to.equal(interestRate);
      // expect(fundedLoan.isFunded).to.equal(true);
      // expect(fundedLoan.isRepaid).to.equal(true); // THIS SHOULD NOW BE TRUE
      // expect(fundedLoan.isDefaulted).to.equal(false);
    });

    it("Should not allow a borrower to repay a loan that has not been funded", async function () {
      assert.fail();
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
      expect(fundedLoan.isFunded).to.equal(true);

      // Attempt to fund the loan again
      expect(collateralizedLoanContract.connect(lender)
        .fundLoan(loanId, { value: loanAmount }))
        .to.be.revertedWith(`Requested loan has already been funded by lender ${lender.address.toLowerCase()}`);

      // Confirm that attempting to fund the loan again did not change its status
      expect(fundedLoan.isFunded).to.equal(true);
    });

    it("Should not allow a borrower to repay a loan that has expired", async function () {
      assert.fail();
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

    it("Should not allow a borrower to repay a loan that has already been repaid", async function () {
      assert.fail();
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

    it("Should not allow a borrower to repay a loan with the incorrect repayment amount", async function () {
      assert.fail();
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

    it("Should emit a CollateralClaimed event upon a successful collateral claim", async function () {
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

    it("Should add the collateral amount (minus gas costs) to the lender's address if the loan defaults", async function () {
      assert.fail();
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
      await borrowerContract.depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Get the borrower's wallet balance before the loan is funded
      const borrowerBalanceBefore = await ethers.provider.getBalance(borrower.address);

      // Have a lender fund the loan
      const loanId = 0;
      await collateralizedLoanContract
        .connect(lender)
        .fundLoan(loanId, { value: loanAmount });

      // Get the borrower's wallet balance after the loan is funded
      const borrowerBalanceAfter = await ethers.provider.getBalance(borrower.address);

      // Calculate the difference in the borrower's balance before and after the loan is funded
      const balanceDifference = borrowerBalanceAfter - borrowerBalanceBefore;

      // Verify that the balance difference is equal to the loan amount
      expect(balanceDifference).to.equal(loanAmount);
    });

    it("Should not allow claiming collateral from a loan that has not been requested", async function () {
      assert.fail();
      const { collateralizedLoanContract, borrower, lender } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // Specify loan parameters
      const collateralAmount = BigInt(3);
      const loanAmount = collateralAmount;

      // Attempt to have a lender fund a loan that has not been requested
      const loanId = 0;
      expect(collateralizedLoanContract.connect(lender)
        .fundLoan(loanId, { value: loanAmount }))
        .to.be.revertedWith("Loan does not exist");
    });

    it("Should not allow anyone but the lender of the loan to claim the collateral", async function () {
      assert.fail();
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
      expect(fundedLoan.isFunded).to.equal(true);

      // Attempt to fund the loan again
      expect(collateralizedLoanContract.connect(lender)
        .fundLoan(loanId, { value: loanAmount }))
        .to.be.revertedWith(`Requested loan has already been funded by lender ${lender.address.toLowerCase()}`);

      // Confirm that attempting to fund the loan again did not change its status
      expect(fundedLoan.isFunded).to.equal(true);
    });

    it("Should not allow a lender to claim collateral from a loan that has not been funded", async function () {
      assert.fail();
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
      expect(fundedLoan.isFunded).to.equal(true);

      // Attempt to fund the loan again
      expect(collateralizedLoanContract.connect(lender)
        .fundLoan(loanId, { value: loanAmount }))
        .to.be.revertedWith(`Requested loan has already been funded by lender ${lender.address.toLowerCase()}`);

      // Confirm that attempting to fund the loan again did not change its status
      expect(fundedLoan.isFunded).to.equal(true);
    });

    it("Should not allow a lender to claim collateral from a loan that was repaid in time", async function () {
      assert.fail();
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

    it("Should not allow a lender to claim collateral from an outstanding loan that has not yet expired", async function () {
      assert.fail();
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
});
