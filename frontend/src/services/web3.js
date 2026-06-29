import { BrowserProvider, parseEther } from 'ethers';
import EthereumProvider from '@walletconnect/ethereum-provider';

const WALLETCONNECT_PROJECT_ID = '2b1a0a1796e0bb0a56cb0b2295e2df34';
let wcProvider = null;

// ================================================================
// ETH — Browser Extension
// ================================================================
export function isETHWalletInstalled() { return typeof window.ethereum !== 'undefined'; }

export function getETHWalletName() {
  if (!window.ethereum) return null;
  if (window.ethereum.isMetaMask) return 'MetaMask';
  if (window.ethereum.isCoinbaseWallet) return 'Coinbase Wallet';
  if (window.ethereum.isBraveWallet) return 'Brave Wallet';
  if (window.ethereum.isTrust) return 'Trust Wallet';
  return 'Browser Wallet';
}

export async function connectETHWallet() {
  if (!window.ethereum) throw new Error('No ETH wallet found. Install MetaMask.');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts?.length) throw new Error('No accounts found.');
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId !== '0x1') {
    try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] }); }
    catch { throw new Error('Switch to Ethereum Mainnet.'); }
  }
  return { address: accounts[0], wallet: getETHWalletName() };
}

export async function sendETHViaBrowser(toAddress, amount) {
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const tx = await signer.sendTransaction({ to: toAddress, value: parseEther(amount.toString()) });
  return { hash: tx.hash, from: await signer.getAddress() };
}

// ================================================================
// ETH — WalletConnect QR
// ================================================================
export async function connectETHWalletConnect(onUri) {
  if (wcProvider) { try { await wcProvider.disconnect(); } catch {} wcProvider = null; }
  wcProvider = await EthereumProvider.init({
    projectId: WALLETCONNECT_PROJECT_ID, chains: [1], optionalChains: [1],
    showQrModal: false, methods: ['eth_sendTransaction', 'personal_sign'],
    events: ['chainChanged', 'accountsChanged'],
  });
  return new Promise((resolve, reject) => {
    wcProvider.on('display_uri', (uri) => { if (onUri) onUri(uri); });
    wcProvider.connect().then(() => {
      if (!wcProvider.accounts?.length) { reject(new Error('No accounts.')); return; }
      resolve({ address: wcProvider.accounts[0], wallet: 'WalletConnect' });
    }).catch(reject);
  });
}

export async function sendETHViaWC(toAddress, amount) {
  if (!wcProvider) throw new Error('WalletConnect not connected.');
  const provider = new BrowserProvider(wcProvider);
  const signer = await provider.getSigner();
  const tx = await signer.sendTransaction({ to: toAddress, value: parseEther(amount.toString()) });
  return { hash: tx.hash, from: await signer.getAddress() };
}

// ================================================================
// TRON — TronLink Extension
// ================================================================
export function isTronLinkInstalled() { return typeof window.tronWeb !== 'undefined' || typeof window.tronLink !== 'undefined'; }

export async function connectTronLink() {
  if (!window.tronWeb?.ready) {
    if (window.tronLink) { await window.tronLink.request({ method: 'tron_requestAccounts' }); await new Promise(r => setTimeout(r, 500)); }
    if (!window.tronWeb?.ready) throw new Error('TronLink not installed or locked.');
  }
  const address = window.tronWeb.defaultAddress.base58;
  if (!address) throw new Error('No TRON account.');
  return { address, wallet: 'TronLink' };
}

export async function sendTRONViaExtension(toAddress, amount) {
  if (!window.tronWeb?.ready) throw new Error('TronLink not connected.');
  const sun = Math.floor(parseFloat(amount) * 1000000);
  const tx = await window.tronWeb.trx.sendTransaction(toAddress, sun);
  if (!tx.result) throw new Error('TRON send failed.');
  return { hash: tx.txid || tx.transaction?.txID, from: window.tronWeb.defaultAddress.base58 };
}

// ================================================================
// BTC — UniSat / Xverse Extension
// ================================================================
export function isBTCWalletInstalled() { return typeof window.unisat !== 'undefined' || typeof window.BitcoinProvider !== 'undefined'; }
export function getBTCWalletName() { if (window.unisat) return 'UniSat'; if (window.BitcoinProvider) return 'Xverse'; return 'BTC Wallet'; }

export async function connectBTCWallet() {
  if (window.unisat) {
    const accounts = await window.unisat.requestAccounts();
    if (!accounts?.length) throw new Error('No BTC accounts.');
    return { address: accounts[0], wallet: 'UniSat' };
  }
  if (window.BitcoinProvider) {
    const resp = await window.BitcoinProvider.request('getAccounts');
    const addr = resp?.result?.[0]?.address || resp?.[0]?.address;
    if (!addr) throw new Error('No BTC accounts.');
    return { address: addr, wallet: 'Xverse' };
  }
  throw new Error('No BTC wallet found. Install UniSat or Xverse.');
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

// ================================================================
// Payment QR URIs
// ================================================================
export function generatePaymentUri(currency, toAddress, amount) {
  if (currency === 'BTC') return `bitcoin:${toAddress}?amount=${amount}`;
  if (currency === 'ETH') return `ethereum:${toAddress}?value=${parseEther(amount.toString())}`;
  if (currency === 'TRON') return `tron:${toAddress}?amount=${amount}`;
  return '';
}

// ================================================================
// Active method tracker
// ================================================================
let activeETHMethod = 'browser';
export function setActiveETHMethod(m) { activeETHMethod = m; }

export async function sendETH(toAddress, amount) {
  if (activeETHMethod === 'walletconnect') return sendETHViaWC(toAddress, amount);
  return sendETHViaBrowser(toAddress, amount);
}
