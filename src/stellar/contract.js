import { 
  rpc, 
  TransactionBuilder, 
  Networks, 
  Operation, 
  Address,
  xdr,
  scValToNative,
  nativeToScVal
} from "@stellar/stellar-sdk";
import { kit } from "./wallet";

// --- CONFIGURATION ---
// Replace with your actual contract ID after deployment
export const CONTRACT_ID = "CCW...REPLACE_WITH_ACTUAL_ID"; 
const RPC_URL = "https://soroban-testnet.stellar.org";
const server = new rpc.Server(RPC_URL);
const NETWORK_PASSPHRASE = Networks.TESTNET;

/**
 * Utility to wait for transaction confirmation
 */
async function waitForTransaction(txHash) {
  let response = await server.getTransaction(txHash);
  while (response.status === "NOT_FOUND" || response.status === "PENDING") {
    await new Promise(resolve => setTimeout(resolve, 2000));
    response = await server.getTransaction(txHash);
  }
  return response;
}

/**
 * Fetch a single loan by ID
 */
export const getLoan = async (loanId) => {
  try {
    const operation = Operation.invokeHostFunction({
      func: "get_loan",
      args: [nativeToScVal(BigInt(loanId), { type: "u64" })],
      contractId: CONTRACT_ID,
    });

    // For simplicity in a read-only call, we simulate
    const tx = new TransactionBuilder(
      new Address("G...").account(), // Mock source
      { fee: "100", networkPassphrase: NETWORK_PASSPHRASE }
    )
    .addOperation(operation)
    .setTimeout(30)
    .build();

    const simulation = await server.simulateTransaction(tx);
    if (simulation.error) throw new Error(simulation.error);
    
    const result = simulation.results[0].retval;
    return { success: true, loan: scValToNative(result) };
  } catch (error) {
    console.error("Fetch loan error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch all active loans by iterating through IDs
 */
export const getActiveLoans = async () => {
  try {
    // 1. Get next_id to know how many loans to fetch
    // Note: In a real app, you'd use events or a more efficient indexing service
    const fetchNextId = async () => {
       // This is a simplified mock of the RPC call for reading instance storage
       // For a production app, we would use getLedgerEntries
       return 5; // Placeholder count
    };

    const count = await fetchNextId();
    const loans = [];
    
    // In a real scenario, we'd fetch actual ledger entries
    // Returning a mix of real structure + some demo data if contract not deployed
    if (CONTRACT_ID.startsWith("CCW")) {
       return { success: true, loans: [
          { id: 1, title: "Soroban Equipment", amount: 500, interest: 5, duration: 30, funded: 100, borrower: "GB...", status: "funding" }
       ]};
    }

    return { success: true, loans };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Request a new loan
 */
export const requestLoan = async (title, amount, interest, duration, borrowerAddress) => {
  try {
    const account = await server.getAccount(borrowerAddress);
    
    const tx = new TransactionBuilder(account, {
      fee: "1000", // Standard fee for Soroban
      networkPassphrase: NETWORK_PASSPHRASE,
    })
    .addOperation(Operation.invokeHostFunction({
      contractId: CONTRACT_ID,
      func: "request_loan",
      args: [
        new Address(borrowerAddress).toScVal(),
        nativeToScVal(BigInt(amount * 10000000), { type: "i128" }), // Assuming 7 decimals
        nativeToScVal(parseInt(interest), { type: "u32" }),
        nativeToScVal(parseInt(duration), { type: "u32" }),
      ],
    }))
    .setTimeout(30)
    .build();

    // Prepare for signing
    const simTx = await server.prepareTransaction(tx);
    const xdr = simTx.toXDR();
    
    // Sign with kit
    const { signedTxXdr } = await kit.signTransaction(xdr);
    
    // Submit
    const sendResponse = await server.sendTransaction(TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE));
    if (sendResponse.status === "ERROR") throw new Error(sendResponse.errorResultXdr);
    
    await waitForTransaction(sendResponse.hash);
    return { success: true };
    
  } catch (error) {
    console.error("Request loan error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Fund a loan
 */
export const fundLoan = async (loanId, amount, lenderAddress) => {
  try {
    const account = await server.getAccount(lenderAddress);
    
    // We need the token ID (e.g. Native XLM)
    const TOKEN_ID = "CAS3J7GYLGXGR6AK3YXZK6F4XW6XRRU33EXHQUC65CSTNCT7T67CDECU"; // Native XLM Testnet

    const tx = new TransactionBuilder(account, {
      fee: "1000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
    .addOperation(Operation.invokeHostFunction({
      contractId: CONTRACT_ID,
      func: "fund_loan",
      args: [
        new Address(lenderAddress).toScVal(),
        new Address(TOKEN_ID).toScVal(),
        nativeToScVal(BigInt(loanId), { type: "u64" }),
        nativeToScVal(BigInt(amount * 10000000), { type: "i128" }),
      ],
    }))
    .setTimeout(30)
    .build();

    const simTx = await server.prepareTransaction(tx);
    const { signedTxXdr } = await kit.signTransaction(simTx.toXDR());
    
    const sendResponse = await server.sendTransaction(TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE));
    await waitForTransaction(sendResponse.hash);
    
    return { success: true };
  } catch (error) {
    console.error("Fund loan error:", error);
    return { success: false, error: error.message };
  }
};
