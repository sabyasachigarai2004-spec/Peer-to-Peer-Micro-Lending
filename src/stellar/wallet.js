import { 
  StellarWalletsKit,
  Networks, 
} from '@creit.tech/stellar-wallets-kit';
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';

// Initialize the kit with static init
StellarWalletsKit.init({
  network: Networks.TESTNET,
  modules: defaultModules(),
});

// Export the class as 'kit' to maintain compatibility with contractSim.js
export const kit = StellarWalletsKit;

export const connectKit = async () => {
  try {
    // authModal returns { address } when successful
    const { address } = await StellarWalletsKit.authModal();
    return { success: true, publicKey: address };
  } catch (error) {
    console.error("Wallet connection failed or closed:", error);
    return { success: false, error: "Connection failed" };
  }
};
