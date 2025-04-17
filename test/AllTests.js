// Test suite for the ColleratalizedLoan contract
describe("CollateralizedLoan", function () {
  require('./requestLoan');
  require('./fundLoan');
  require('./repayLoan');
  require('./claimCollateral');
});
