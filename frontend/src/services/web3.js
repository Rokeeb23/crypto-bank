import { BrowserProvider, parseEther } from 'ethers';
import UniversalProvider from '@walletconnect/universal-provider';

// ============================================================
// WalletConnect — Universal Multi-Chain Provider
// Single QR scan connects ETH + TRON + BTC simultaneously
// ============================================================

const PROJECT_ID = '0874b25d08a00bf77b0ebe5a7fe6867d';

// Chain IDs (CAIP-2 format)
const CHAINS = {
  ETH: 'eip155:1',          // Ethereum mainnet
  TRON: 'tron:0x2b6653dc',  // TRON mainnet
  BTC: 'bip122:000000000019d6689c085ae165831e93', // Bitcoin mainnet
};

let provider = null;
let session = null;

// ========================
// Connect — one QR for all chains
// ========================

export async function connectWalletConnect(onUri) {
  // Clean up old session
  if (provider) {
    try { await provider.disconnect(); } catch {}
    provider = null;
    session = null;
  }

  provider = await UniversalProvider.init({
    projectId: PROJECT_ID,
    metadata: {
      name: 'CryptoBank',
      description: 'Multi-chain crypto transactions',
      url: window.location.origin,
      icons: [],
    },
  });

  return new Promise((resolve, reject) => {
    provider.on('display_uri', (uri) => {
      console.log('WalletConnect URI:', uri);
      if (onUri) onUri(uri);
    });

    provider.connect({
      optionalNamespaces: {
        eip155: {
          methods: ['eth_sendTransaction', 'personal_sign', 'eth_sign'],
          chains: ['eip155:1'],
          events: ['chainChanged', 'accountsChanged'],
        },
        tron: {
          methods: ['tron_signTransaction', 'tron_signMessage'],
          chains: ['tron:0x2b6653dc'],
          events: [],
        },
        bip122: {
          methods: ['sendTransfer', 'getAccountAddresses', 'signPsbt', 'signMessage'],
          chains: ['bip122:000000000019d6689c085ae165831e93'],
          events: ['bip122_addressesChanged'],
        },
      },
    }).then((s) => {
      session = s;
      const result = getConnectedAccounts();
      resolve(result);
    }).catch(reject);
  });
}

export function getConnectedAccounts() {
  if (!session) return { eth: null, tron: null, btc: null, wallet: null };

  const namespaces = session.namespaces || {};
  let eth = null, tron = null, btc = null;

  // EIP155 (Ethereum)
  if (namespaces.eip155?.accounts) {
    for (const acc of namespaces.eip155.accounts) {
      const parts = acc.split(':');
      eth = parts[2]; // address is the 3rd part: eip155:1:0xabc...
      break;
    }
  }

  // TRON
  if (namespaces.tron?.accounts) {
    for (const acc of namespaces.tron.accounts) {
      const parts = acc.split(':');
      tron = parts[2]; // tron:0x2b6653dc:Txyz...
      break;
    }
  }

  // BTC (bip122)
  if (namespaces.bip122?.accounts) {
    for (const acc of namespaces.bip122.accounts) {
      // Format: bip122:000000000019d6689c085ae165831e93:bc1q...
      const parts = acc.split(':');
      btc = parts.slice(2).join(':'); // rejoin in case address has colons
      break;
    }
  }

  const walletName = session.peer?.metadata?.name || 'WalletConnect';
  return { eth, tron, btc, wallet: walletName };
}

export function isConnected() {
  return !!session;
}

export function getProvider() {
  return provider;
}

export function getSession() {
  return session;
}

// ========================
// Send ETH via WalletConnect
// ========================

export async function sendETHViaWC(toAddress, amount) {
  if (!provider || !session) throw new Error('WalletConnect not connected.');

  const ethProvider = new BrowserProvider(provider);
  const signer = await ethProvider.getSigner();
  const tx = await signer.sendTransaction({
    to: toAddress,
    value: parseEther(amount.toString()),
  });

  return { hash: tx.hash, from: await signer.getAddress() };
}

// ========================
// Send TRON via WalletConnect
// ========================

export async function sendTRONViaWC(fromAddress, toAddress, amount) {
  if (!provider || !session) throw new Error('WalletConnect not connected.');

  const sun = Math.floor(parseFloat(amount) * 1000000);

  // Build TRON transfer transaction
  const transaction = {
    to_address: toAddress,
    owner_address: fromAddress,
    amount: sun,
  };

  // Request TRON sign via WalletConnect
  const result = await provider.request({
    method: 'tron_signTransaction',
    params: [transaction],
  }, 'tron:0x2b6653dc');

  if (!result || !result.txID) {
    throw new Error('TRON transaction signing failed');
  }

  return { hash: result.txID, from: fromAddress };
}

// ========================
// Send BTC via WalletConnect
// ========================

export async function sendBTCViaWC(fromAddress, toAddress, amount) {
  if (!provider || !session) throw new Error('WalletConnect not connected.');

  const sats = Math.round(parseFloat(amount) * 100000000).toString();

  const result = await provider.request({
    method: 'sendTransfer',
    params: {
      account: fromAddress,
      recipientAddress: toAddress,
      amount: sats,
      memo: 'CryptoBank transfer',
    },
  }, `bip122:000000000019d6689c085ae165831e93`);

  if (!result?.txid) {
    throw new Error('BTC transaction failed');
  }

  return { hash: result.txid, from: fromAddress };
}

// ========================
// Disconnect
// ========================

export async function disconnect() {
  if (provider) {
    try { await provider.disconnect(); } catch {}
    provider = null;
    session = null;
  }
}

// ========================
// Browser extension fallbacks (still available)
// ========================

// ETH
export function isETHWalletInstalled() { return typeof window.ethereum !== 'undefined'; }
export function getETHWalletName() {
  if (!window.ethereum) return null;
  if (window.ethereum.isMetaMask) return 'MetaMask';
  if (window.ethereum.isCoinbaseWallet) return 'Coinbase Wallet';
  if (window.ethereum.isBraveWallet) return 'Brave Wallet';
  if (window.ethereum.isTrust) return 'Trust Wallet';
  return 'Browser Wallet';
}

export async function connectETHExtension() {
  if (!window.ethereum) throw new Error('No ETH wallet extension found.');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts?.length) throw new Error('No accounts found.');
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId !== '0x1') {
    try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] }); }
    catch { throw new Error('Switch to Ethereum Mainnet.'); }
  }
  return { address: accounts[0], wallet: getETHWalletName() };
}

export async function sendETHViaExtension(toAddress, amount) {
  const p = new BrowserProvider(window.ethereum);
  const signer = await p.getSigner();
  const tx = await signer.sendTransaction({ to: toAddress, value: parseEther(amount.toString()) });
  return { hash: tx.hash, from: await signer.getAddress() };
}

// TRON
export function isTronLinkInstalled() { return typeof window.tronWeb !== 'undefined' || typeof window.tronLink !== 'undefined'; }

export async function connectTronLinkExtension() {
  if (!window.tronWeb?.ready) {
    if (window.tronLink) { await window.tronLink.request({ method: 'tron_requestAccounts' }); await new Promise(r => setTimeout(r, 500)); }
    if (!window.tronWeb?.ready) throw new Error('TronLink not installed or locked.');
  }
  return { address: window.tronWeb.defaultAddress.base58, wallet: 'TronLink' };
}

export async function sendTRONViaExtension(toAddress, amount) {
  if (!window.tronWeb?.ready) throw new Error('TronLink not connected.');
  const sun = Math.floor(parseFloat(amount) * 1000000);
  const tx = await window.tronWeb.trx.sendTransaction(toAddress, sun);
  if (!tx.result) throw new Error('TRON send failed.');
  return { hash: tx.txid || tx.transaction?.txID, from: window.tronWeb.defaultAddress.base58 };
}

// BTC
export function isBTCWalletInstalled() { return typeof window.unisat !== 'undefined' || typeof window.BitcoinProvider !== 'undefined'; }
export function getBTCWalletName() { if (window.unisat) return 'UniSat'; if (window.BitcoinProvider) return 'Xverse'; return 'BTC Wallet'; }

export async function connectBTCExtension() {
  if (window.unisat) {
    const accs = await window.unisat.requestAccounts();
    return { address: accs[0], wallet: 'UniSat' };
  }
  if (window.BitcoinProvider) {
    const resp = await window.BitcoinProvider.request('getAccounts');
    return { address: resp?.result?.[0]?.address || resp?.[0]?.address, wallet: 'Xverse' };
  }
  throw new Error('No BTC wallet extension found.');
}

export async function sendBTCViaExtension(toAddress, amountBtc) {
  const sats = Math.round(parseFloat(amountBtc) * 100000000);
  if (window.unisat) {
    const txid = await window.unisat.sendBitcoin(toAddress, sats);
    return { hash: txid, from: (await window.unisat.getAccounts())[0] };
  }
  if (window.BitcoinProvider) {
    const resp = await window.BitcoinProvider.request('sendTransfer', { recipients: [{ address: toAddress, amount: sats }] });
    return { hash: resp?.result?.txid || resp?.txid, from: '' };
  }
  throw new Error('No BTC wallet connected.');
}

// Payment QR URI generators
export function generatePaymentUri(currency, toAddress, amount) {
  if (currency === 'BTC') return `bitcoin:${toAddress}?amount=${amount}`;
  if (currency === 'ETH') return `ethereum:${toAddress}?value=${parseEther(amount.toString())}`;
  if (currency === 'TRON') return `tron:${toAddress}?amount=${amount}`;
  return '';
}
