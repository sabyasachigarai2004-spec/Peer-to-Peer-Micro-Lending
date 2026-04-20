import { Horizon, TransactionBuilder, Networks, Operation } from "@stellar/stellar-sdk";
import { kit } from "./wallet";

// Horizon server connected to testnet
const server = new Horizon.Server("https://horizon-testnet.stellar.org");

const simulateDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Mock database to hold state between tabs
let activeLoans = [
  {
    id: "LOAN-101",
    title: "Equipment Purchase",
    amount: 500,
    interest: 5,
    duration: 30,
    funded: 150,
    borrower: "GBABC...XYZ",
    status: "funding"
  },
  {
    id: "LOAN-102",
    title: "Inventory Restock",
    amount: 1000,
    interest: 8,
    duration: 60,
    funded: 1000,
    borrower: "GBDEF...UVZ",
    status: "active"
  }
];

export const getActiveLoans = async () => {
  await simulateDelay(600);
  return { success: true, loans: activeLoans };
};

export const requestLoan = async (title, amount, interest, duration, borrowerAddress) => {
  try {
    // 1. Fetch account details to get sequence number
    const account = await server.loadAccount(borrowerAddress);

    // 2. Build a transaction requesting the loan (For mock purposes, storing a ManageData payload)
    const transaction = new TransactionBuilder(account, {
      fee: "100" // Min fee
    })
      .addOperation(Operation.manageData({
        name: `loan_req_${Math.floor(Math.random() * 10000)}`,
        value: `${amount} XLM - ${interest}%`
      }))
      .setTimeout(30)
      .setNetworkPassphrase(Networks.TESTNET)
      .build();

    // 3. Get the XDR
    const xdr = transaction.toXDR();

    // 4. Send to kit for user signature
    const signedTxResponse = await kit.signTransaction(xdr, { networkPassphrase: Networks.TESTNET });
    if (!signedTxResponse) throw new Error("Transaction signature was rejected or failed");
    const signedTx = signedTxResponse.signedTxXdr || signedTxResponse.result || signedTxResponse;

    // We skip actually submitting it to Horizon for the UI simulation but we proved connection
    console.log("Successfully signed Loan Request TX:", signedTx);

    const newLoan = {
      id: `LOAN-${Math.floor(Math.random() * 1000) + 200}`,
      title,
      amount: parseFloat(amount),
      interest: parseFloat(interest),
      duration: parseInt(duration),
      funded: 0,
      borrower: borrowerAddress,
      status: "funding"
    };

    activeLoans.unshift(newLoan);
    return { success: true, loan: newLoan };
    
  } catch (error) {
    console.error("Error creating loan transaction:", error);
    return { success: false, error: error.message || "Failed to sign or build transaction" };
  }
};

export const fundLoan = async (loanId, lenderAddress) => {
  try {
    const loanIndex = activeLoans.findIndex(l => l.id === loanId);
    if (loanIndex === -1 || activeLoans[loanIndex].status !== "funding") {
      return { success: false, error: "Loan not found or already active." };
    }
    
    // 1. Fetch lender's account for sequence
    const account = await server.loadAccount(lenderAddress);
    const loanToFund = activeLoans[loanIndex];
    
    // 2. Build a payment transaction to simulate funding (Mock destination wrapper)
    // We send to an arbitrary valid testnet address matching the 'escrow' concept
    const mockEscrow = "GA2C5RFPE6GCKMY3US5PAB6UZLKIGSPIUKSLZR4QYWMM3BFCV2GFZNRH"; 
    
    const transaction = new TransactionBuilder(account, { fee: "100" })
      .addOperation(Operation.payment({
        destination: mockEscrow,
        asset: Horizon.Asset.native(),
        amount: loanToFund.amount.toString(),
      }))
      .setTimeout(30)
      .setNetworkPassphrase(Networks.TESTNET)
      .build();

    // 3. Get XDR & Sign via kit
    const xdr = transaction.toXDR();
    const signedTxResponse = await kit.signTransaction(xdr, { networkPassphrase: Networks.TESTNET });
    if (!signedTxResponse) throw new Error("Funding signature was rejected or failed");
    const signedTx = signedTxResponse.signedTxXdr || signedTxResponse.result || signedTxResponse;

    console.log("Successfully signed Loan Funding TX:", signedTx);

    // Update simulation state
    activeLoans[loanIndex].funded = loanToFund.amount;
    activeLoans[loanIndex].status = "active";
    activeLoans[loanIndex].lender = lenderAddress;
    
    return { success: true, loan: activeLoans[loanIndex] };
    
  } catch (error) {
    console.error("Error creating funding transaction:", error);
    return { success: false, error: error.message || "Failed to fund loan" };
  }
};
