// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Strings.sol";

// Collateralized Loan Contract
contract CollateralizedLoan {

    // Define the structure of a loan
    struct Loan {
        uint loanId;
        address payable borrower;
        address payable lender;
        uint collateralAmount;
        uint loanAmount;
        uint interestRate;
        uint dueDate;
        bool isFunded;
        bool isRepaid;
        bool isDefaulted;
    }

    // Create a mapping to manage the loans
    mapping(uint => Loan) public loans;
    uint public nextLoanId = 0;

    event LoanRequested(address indexed borrower, uint collateralAmount, uint loanAmount, uint interestRate, uint dueDate);
    event LoanFunded(uint loanId);
    event LoanRepaid(uint loanId);
    event CollateralClaimed(address indexed borrower, address indexed lender, uint collateralAmount);

    function loanExists(Loan memory loanToCheck) public view returns (bool) {

        // Check if a requested loan has already been requested
        for (uint i = 0; i < nextLoanId; i++) {
            Loan memory existingLoan = loans[i];

            if (existingLoan.borrower == loanToCheck.borrower && 
                existingLoan.collateralAmount == loanToCheck.collateralAmount && 
                existingLoan.loanAmount == loanToCheck.loanAmount && 
                existingLoan.interestRate == loanToCheck.interestRate &&
                existingLoan.isFunded == loanToCheck.isFunded &&
                existingLoan.isRepaid == loanToCheck.isRepaid &&
                existingLoan.isDefaulted == loanToCheck.isDefaulted) {
                return true;
            }
        }

        return false;
    }

    // Ensure that a requested loan does not already exist
    modifier doesNotExist(Loan memory loanToCheck) {
        require(!loanExists(loanToCheck), string.concat("Loan with these parameters has already been requested by borrower ", 
            Strings.toHexString(loanToCheck.borrower)));
        _;
    }

    // Ensure that a requested loan is not already funded
    modifier notAlreadyFunded(uint _loanId) {
        require(loans[_loanId].isFunded == false, string.concat("Requested loan has already been funded by lender ", 
            Strings.toHexString(loans[_loanId].lender)));
        _;
    }

    // Function to deposit collateral and request a loan
    function depositCollateralAndRequestLoan(uint _interestRate, uint _duration) external payable {
        require(msg.value > 0, "Collateral amount must be greater than 0");

        // Calculate loan due date
        uint _dueDate = block.timestamp + _duration;

        // Construct a new Loan 
        Loan memory newLoan = Loan({
            loanId: nextLoanId,
            borrower: payable(msg.sender),
            lender: payable(address(0)), // No lender yet
            collateralAmount: msg.value,
            loanAmount: msg.value,
            interestRate: _interestRate,
            dueDate: _dueDate,
            isFunded: false,
            isRepaid: false,
            isDefaulted: false
        });

        // Call helper function with modifier
        _createNewLoan(newLoan);
    }

    // Actually create the loan interally
    function _createNewLoan(Loan memory newLoan) internal doesNotExist(newLoan) {
        loans[nextLoanId++] = newLoan; // Create a new loan in the mapping
        emit LoanRequested(newLoan.borrower, newLoan.collateralAmount, newLoan.loanAmount, newLoan.interestRate, newLoan.dueDate);
    }

    // Function to fund a loan
    function fundLoan(uint _loanId) external payable notAlreadyFunded(_loanId) {
        require(_loanId < nextLoanId, "Loan does not exist");
        Loan storage loan = loans[_loanId];
        require(msg.value == loan.loanAmount, "Incorrect funding amount");
        require(block.timestamp < loan.dueDate, "Loan has expired");

        // Set the message sander as the lender
        loan.lender = payable(msg.sender);
        loan.isFunded = true;

        // Emit event
        emit LoanFunded(_loanId);

        // Transfer the loan amount to the borrower
        loan.borrower.transfer(msg.value);
    }

    // Function to repay a loan
    function repayLoan(uint _loanId) external payable {
        require(_loanId < nextLoanId, "Loan does not exist");
        Loan storage loan = loans[_loanId];
        require(msg.sender == loan.borrower, "Only the borrower can repay this loan");
        require(loan.isFunded, "Loan has not yet been funded");
        require(block.timestamp <= loan.dueDate, "Loan has expired and cannot be repaid");
        require(!loan.isRepaid, "Loan has already been repaid");
    
        // Calculate repayment amount (principal + interest)
        uint repaymentAmount = loan.loanAmount + ((loan.loanAmount * loan.interestRate) / 100);
    
        // Check if the correct amount is being sent
        require(msg.value == repaymentAmount, "Incorrect repayment amount");
    
        // Mark loan as repaid
        loan.isRepaid = true;

        // Emit event
        emit LoanRepaid(_loanId);
        
        // Transfer funds to lender
        loan.lender.transfer(msg.value);

        // Return collateral to borrower
        loan.borrower.transfer(loan.collateralAmount);
    }

    // Function to claim collateral on default
    function claimCollateral(uint _loanId) external {
        require(_loanId < nextLoanId, "Loan does not exist");
        Loan storage loan = loans[_loanId];
        require(msg.sender == loan.lender, "Only the lender can claim the collateral of this loan");
        require(loan.isFunded, "Loan has not yet been funded");
        require(!loan.isRepaid, "Loan was repaid on time");
        require(block.timestamp > loan.dueDate, "Loan is not yet past due date");
        require(!loan.isDefaulted, "Collateral has already been claimed");

        // Mark loan as closed
        loan.isDefaulted = true;
        
        // Emit event
        emit CollateralClaimed(loan.borrower, loan.lender, loan.collateralAmount);
        
        // Transfer collateral to lender
        loan.lender.transfer(loan.collateralAmount);
    }
}