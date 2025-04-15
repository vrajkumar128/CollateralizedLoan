// Importing necessary modules and functions from Hardhat and Chai for testing
const runRequestLoanTests = require('./requestLoan');
const runFundLoanTests = require('./fundLoan');
const runRepayLoanTests = require('./repayLoan');
const runClaimCollateralTests = require('./claimCollateral');

// Test suite for the ColleratalizedLoan contract
describe("CollateralizedLoan", function () {
  runRequestLoanTests();
  runFundLoanTests();
  runRepayLoanTests();
  runClaimCollateralTests();
});
