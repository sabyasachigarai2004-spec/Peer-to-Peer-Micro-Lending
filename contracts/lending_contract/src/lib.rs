#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Token,
};

#[derive(Clone)]
#[contracttype]
pub enum LoanStatus {
    Funding = 0,
    Active = 1,
    Repaid = 2,
    Withdrawn = 3,
}

#[derive(Clone)]
#[contracttype]
pub struct Loan {
    pub id: u64,
    pub borrower: Address,
    pub lender: Option<Address>,
    pub target_amount: i128,
    pub funded_amount: i128,
    pub interest_rate: u32,
    pub duration_days: u32,
    pub status: LoanStatus,
}

#[contract]
pub struct LendingContract;

#[contractimpl]
impl LendingContract {
    /// Request a new loan
    pub fn request_loan(
        env: Env,
        borrower: Address,
        amount: i128,
        interest: u32,
        duration: u32,
    ) -> u64 {
        borrower.require_auth();

        let mut next_id: u64 = env.storage().instance().get(&symbol_short!("next_id")).unwrap_or(1);
        
        let loan = Loan {
            id: next_id,
            borrower: borrower.clone(),
            lender: None,
            target_amount: amount,
            funded_amount: 0,
            interest_rate: interest,
            duration_days: duration,
            status: LoanStatus::Funding,
        };

        // Store the loan data
        env.storage().persistent().set(&next_id, &loan);
        
        // Increment ID
        env.storage().instance().set(&symbol_short!("next_id"), &(next_id + 1));

        next_id
    }

    /// Fund an existing loan
    pub fn fund_loan(env: Env, lender: Address, token: Address, loan_id: u64, amount: i128) {
        lender.require_auth();

        let mut loan: Loan = env.storage().persistent().get(&loan_id).expect("Loan not found");
        
        // Validate status
        if let LoanStatus::Funding = loan.status {
            // OK
        } else {
            panic!("Loan is not in funding state");
        }

        let new_funded = loan.funded_amount + amount;
        assert!(new_funded <= loan.target_amount, "Overfunding not allowed");

        // Transfer funds from Lender to Contract
        let client = Token::Client::new(&env, &token);
        client.transfer(&lender, &env.current_contract_address(), &amount);

        // Update loan data
        loan.funded_amount = new_funded;
        if loan.funded_amount == loan.target_amount {
            loan.status = LoanStatus::Active;
            loan.lender = Some(lender);
        }

        env.storage().persistent().set(&loan_id, &loan);
    }

    /// Borrower withdraws funded amount
    pub fn withdraw(env: Env, loan_id: u64, token: Address) {
        let mut loan: Loan = env.storage().persistent().get(&loan_id).expect("Loan not found");
        loan.borrower.require_auth();

        assert!(loan.funded_amount >= loan.target_amount, "Not fully funded");
        
        if let LoanStatus::Active = loan.status {
            // OK
        } else {
            panic!("Invalid loan status for withdrawal");
        }

        let client = Token::Client::new(&env, &token);
        client.transfer(&env.current_contract_address(), &loan.borrower, &loan.funded_amount);

        loan.status = LoanStatus::Withdrawn;
        env.storage().persistent().set(&loan_id, &loan);
    }

    /// Borrower repays the loan
    pub fn repay(env: Env, loan_id: u64, token: Address, amount: i128) {
        let mut loan: Loan = env.storage().persistent().get(&loan_id).expect("Loan not found");
        loan.borrower.require_auth();

        let lender = loan.lender.as_ref().expect("No lender assigned");

        // Simple interest calculation: target + (target * rate / 100)
        let interest = (loan.target_amount * loan.interest_rate as i128) / 100;
        let total_repay = loan.target_amount + interest;
        
        assert!(amount >= total_repay, "Insufficient repay amount");

        let client = Token::Client::new(&env, &token);
        // Transfer from Borrower -> Lender
        client.transfer(&loan.borrower, &lender, &amount);

        loan.status = LoanStatus::Repaid;
        env.storage().persistent().set(&loan_id, &loan);
    }

    /// View functions
    pub fn get_loan(env: Env, loan_id: u64) -> Option<Loan> {
        env.storage().persistent().get(&loan_id)
    }

    pub fn get_next_id(env: Env) -> u64 {
        env.storage().instance().get(&symbol_short!("next_id")).unwrap_or(1)
    }
}
