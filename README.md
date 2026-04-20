# Peer-to-Peer Micro-Lending dApp

A decentralized, peer-to-peer micro-lending platform built on the **Stellar blockchain** using **Soroban smart contracts**. This dApp connects borrowers and lenders directly, enabling transparent, trustless, and secure loan agreements — all without intermediaries.

---

## 🌟 Features

- **Request Loans** — Borrowers submit a loan request specifying the target amount, interest rate, and duration. The request is recorded on-chain via a Soroban smart contract invocation.
- **Fund Loans** — Lenders browse open loan requests and fund them directly. The contract handles token transfers into escrow and marks the loan as active once fully funded.
- **Withdraw Funds** — Once a loan is fully funded, the borrower can withdraw the escrowed funds from the smart contract to their wallet.
- **Repay Loans** — Borrowers repay the principal plus agreed-upon interest. The contract transfers funds directly to the lender and marks the loan as repaid.
- **Multi-Wallet Support** — Seamless integration with Stellar wallets (Freighter, xBull, etc.) via `@creit.tech/stellar-wallets-kit`.

---

## 📂 Project Structure

```
Peer-to-Peer Micro-Lending/
│
├── contracts/                        # ── Soroban Smart Contracts ──
│   └── lending_contract/
│       ├── Cargo.toml                # Rust crate manifest (soroban-sdk v20)
│       └── src/
│           └── lib.rs                # Core lending contract logic
│
├── src/                              # ── React Frontend ──
│   ├── main.jsx                      # React entry point
│   ├── App.jsx                       # Main application component (UI + state)
│   ├── App.css                       # Component-scoped styles
│   ├── index.css                     # Global design system & CSS variables
│   ├── assets/                       # Static assets (images, icons)
│   └── stellar/                      # ── Blockchain Integration Layer ──
│       ├── wallet.js                 # Wallet connection via StellarWalletsKit
│       ├── contract.js               # Production Soroban RPC contract calls
│       └── contractSim.js            # Simulated contract layer for development
│
├── public/                           # Public static files
├── index.html                        # HTML entry point
├── package.json                      # Node.js dependencies & scripts
├── vite.config.js                    # Vite bundler configuration
├── eslint.config.js                  # ESLint configuration
└── README.md
```

---

## 🏗 Architecture

| Layer              | Technology                         | Purpose                                             |
| ------------------ | ---------------------------------- | --------------------------------------------------- |
| **Frontend**       | React 19 + Vite 8                  | Reactive UI with fast HMR dev experience            |
| **Styling**        | Vanilla CSS (glassmorphism design) | Modern, premium design with CSS variables           |
| **Icons**          | Lucide React                       | Consistent, lightweight SVG icon library            |
| **Smart Contract** | Rust + Soroban SDK v20             | On-chain loan lifecycle logic compiled to WASM       |
| **Blockchain RPC** | `@stellar/stellar-sdk` v15         | Transaction building, simulation, and submission     |
| **Wallet Auth**    | `@creit.tech/stellar-wallets-kit`  | Multi-wallet modal (Freighter, xBull, Albedo, etc.) |

---

## 📜 Smart Contract — `lending_contract`

**Location:** `contracts/lending_contract/src/lib.rs`

The Soroban smart contract is written in Rust (`#![no_std]`) and compiled to WebAssembly for deployment on the Stellar network.

### Data Model

```rust
pub struct Loan {
    pub id: u64,                    // Unique auto-incremented loan ID
    pub borrower: Address,          // Stellar address of the borrower
    pub lender: Option<Address>,    // Assigned when loan is fully funded
    pub target_amount: i128,        // Requested loan amount (in stroops)
    pub funded_amount: i128,        // Amount currently funded
    pub interest_rate: u32,         // Interest rate as a whole percentage
    pub duration_days: u32,         // Loan term in days
    pub status: LoanStatus,         // Current lifecycle state
}
```

### Loan Lifecycle

```
  ┌──────────┐     fund_loan()     ┌──────────┐     withdraw()     ┌─────────────┐     repay()     ┌──────────┐
  │ Funding  │ ──────────────────▶ │  Active  │ ────────────────▶ │  Withdrawn  │ ───────────────▶ │  Repaid  │
  └──────────┘   (fully funded)    └──────────┘                    └─────────────┘                  └──────────┘
```

### Contract Functions

| Function         | Auth Required | Description                                                              |
| ---------------- | ------------- | ------------------------------------------------------------------------ |
| `request_loan()` | Borrower      | Creates a new loan in `Funding` state. Returns the new loan ID.          |
| `fund_loan()`    | Lender        | Transfers tokens from the lender to the contract escrow. Marks `Active` when target is reached. |
| `withdraw()`     | Borrower      | Transfers escrowed funds from the contract to the borrower. Marks `Withdrawn`. |
| `repay()`        | Borrower      | Calculates principal + simple interest and transfers repayment to the lender. Marks `Repaid`. |
| `get_loan()`     | None          | Read-only. Returns a single `Loan` struct by ID.                         |
| `get_next_id()`  | None          | Read-only. Returns the next available loan ID counter.                   |

### Building the Contract

```bash
cd contracts/lending_contract

# Build the optimized WASM binary
cargo build --target wasm32-unknown-unknown --release

# Deploy to Stellar Testnet using Soroban CLI
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/soroban_micro_lending.wasm \
  --source <YOUR_SECRET_KEY> \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
```

After deployment, copy the returned **Contract ID** and update it in `src/stellar/contract.js`:

```js
export const CONTRACT_ID = "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
```

### Cargo.toml

```toml
[package]
name = "soroban-micro-lending"
version = "0.0.0"
edition = "2021"

[dependencies]
soroban-sdk = "20.0.0"

[profile.release]
opt-level = "s"        # Optimize for small binary size
lto = true             # Link-time optimization
panic = "abort"        # Smaller panic handler
```

---

## 🔗 Codebase Integration — How Frontend Talks to the Blockchain

The `src/stellar/` directory is the integration bridge between the React UI and the Stellar/Soroban network. It contains three modules:

### 1. `wallet.js` — Wallet Connection

Initializes `StellarWalletsKit` for Testnet and exposes a `connectKit()` function that opens a multi-wallet authentication modal. Returns the user's public Stellar address upon successful connection.

```
App.jsx  ──▶  connectKit()  ──▶  StellarWalletsKit.authModal()  ──▶  User's Public Key
```

**Key exports:**
- `kit` — The initialized `StellarWalletsKit` instance (used for transaction signing).
- `connectKit()` — Opens the wallet modal; returns `{ success, publicKey }`.

---

### 2. `contract.js` — Production Soroban RPC Calls

Contains the real on-chain transaction builders that interact with the deployed Soroban contract via the Soroban RPC server (`https://soroban-testnet.stellar.org`).

**Integration flow for a write operation (e.g., `requestLoan`):**

```
User clicks "Submit"
    │
    ▼
App.jsx calls requestLoan(title, amount, interest, duration, address)
    │
    ▼
contract.js builds a TransactionBuilder with Operation.invokeHostFunction()
    │  ├── contractId: CONTRACT_ID
    │  ├── func: "request_loan"
    │  └── args: [borrower, amount(i128), interest(u32), duration(u32)]
    │
    ▼
Transaction is simulated via server.prepareTransaction(tx)
    │
    ▼
Prepared XDR is sent to kit.signTransaction() → Freighter popup
    │
    ▼
Signed TX is submitted via server.sendTransaction()
    │
    ▼
waitForTransaction() polls for confirmation
    │
    ▼
{ success: true } returned to App.jsx → UI updates
```

**Key exports:**
- `CONTRACT_ID` — The deployed Soroban contract address (must be updated after deployment).
- `getLoan(loanId)` — Simulates a read-only call to fetch a single loan.
- `getActiveLoans()` — Fetches all available loan opportunities.
- `requestLoan(title, amount, interest, duration, borrowerAddress)` — Builds, signs, and submits a `request_loan` invocation.
- `fundLoan(loanId, amount, lenderAddress)` — Builds, signs, and submits a `fund_loan` invocation. Uses the native XLM token contract for transfers.

---

### 3. `contractSim.js` — Development Simulation Layer

Provides the **same API surface** as `contract.js` but uses in-memory mock data and Horizon `ManageData`/`Payment` operations instead of real Soroban invocations. This allows UI development and testing without a deployed contract.

**How it works:**
- Maintains an in-memory `activeLoans[]` array with sample loan data.
- `requestLoan()` builds a real `ManageData` transaction and signs it via the wallet (proving wallet connectivity), but stores the resulting loan only in local state.
- `fundLoan()` builds a real `Payment` transaction to a mock escrow address and signs it via the wallet, then updates the in-memory loan status.

**Switching between simulation and production:**

In `src/App.jsx`, change the import path:

```js
// For development/simulation (no deployed contract needed):
import { getActiveLoans, requestLoan, fundLoan } from './stellar/contractSim';

// For production (requires a deployed Soroban contract):
import { getActiveLoans, requestLoan, fundLoan } from './stellar/contract';
```

Both modules export the same function signatures, making the swap seamless.

---

## 🚀 Getting Started

### Prerequisites

| Requirement                  | Purpose                              |
| ---------------------------- | ------------------------------------ |
| **Node.js** v18+             | Run the Vite dev server              |
| **Freighter Wallet**         | Browser extension for signing TXs    |
| **Rust toolchain** (optional)| Only needed to modify/deploy contracts |
| **Soroban CLI** (optional)   | Only needed to deploy contracts       |

### Installation

```bash
# Clone and enter the project
cd Peer-to-Peer\ Micro-Lending

# Install frontend dependencies
npm install
```

### Running Locally

```bash
npm run dev
```

The application will be available at **http://localhost:5173**.  
Make sure your Freighter wallet is connected to the **Stellar Testnet**.

### Building for Production

```bash
npm run build
npm run preview    # Preview the production build locally
```

---

## 🔑 Configuration

| Variable       | File                     | Description                                     |
| -------------- | ------------------------ | ----------------------------------------------- |
| `CONTRACT_ID`  | `src/stellar/contract.js`| Deployed Soroban contract address                |
| `RPC_URL`      | `src/stellar/contract.js`| Soroban RPC endpoint (default: Testnet)          |
| `TOKEN_ID`     | `src/stellar/contract.js`| SAC token contract for XLM on Testnet            |
| `Networks`     | `src/stellar/wallet.js`  | Network selection (TESTNET / PUBLIC)             |

---

## 📜 License

This project is intended for educational and developmental purposes.
