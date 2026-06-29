import { useState } from 'react';
import { HiLightningBolt, HiCheckCircle } from 'react-icons/hi';
import {
  connectWalletConnect, getConnectedAccounts, isConnected,
  sendETHViaWC, sendTRONViaWC, sendBTCViaWC,
  connectETHExtension, connectTronLinkExtension, connectBTCExtension,
  sendETHViaExtension, sendTRONViaExtension, sendBTCViaExtension,
  isETHWalletInstalled, isTronLinkInstalled, isBTCWalletInstalled,
  getETHWalletName, getBTCWalletName
} from '../../services/web3';
import QRModal from '../common/QRModal';
import toast from 'react-hot-toast';

export default function ExtensionSend({ currency, onSuccess, onError }) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [walletName, setWalletName] = useState('');
  const [sendMethod, setSendMethod] = useState(''); // 'wc' or 'ext'
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [wcUri, setWcUri] = useState('');
  const [showQR, setShowQR] = useState(false);

  // WalletConnect — works for ETH + TRON
  const connectViaWC = async () => {
    setShowQR(true); setWcUri('');
    try {
      const accounts = await connectWalletConnect((uri) => setWcUri(uri));
      setShowQR(false);
      const addr = currency === 'ETH' ? accounts.eth : currency === 'TRON' ? accounts.tron : accounts.btc;
      if (!addr) {
        toast.error(`Wallet didn't return a ${currency} account. Try a wallet that supports ${currency}.`);
        return;
      }
      setAddress(addr);
      setWalletName(accounts.wallet);
      setSendMethod('wc');
      setConnected(true);
      toast.success(`${accounts.wallet} connected for ${currency}!`);
    } catch (err) {
      setShowQR(false);
      if (!err.message?.includes('rejected')) toast.error(err.message);
    }
  };

  // Browser extension
  const connectViaExtension = async (type) => {
    try {
      let result;
      if (type === 'eth') result = await connectETHExtension();
      else if (type === 'tron') result = await connectTronLinkExtension();
      else if (type === 'btc') result = await connectBTCExtension();
      setAddress(result.address);
      setWalletName(result.wallet);
      setSendMethod('ext');
      setConnected(true);
      toast.success(`${result.wallet} connected!`);
    } catch (err) { toast.error(err.message); }
  };

  const handleSend = async () => {
    if (!recipient || !amount) { toast.error('Enter recipient and amount'); return; }
    setSending(true);
    try {
      let result;

      if (sendMethod === 'wc') {
        // Send via WalletConnect session
        if (currency === 'ETH') result = await sendETHViaWC(recipient, amount);
        else if (currency === 'TRON') result = await sendTRONViaWC(address, recipient, amount);
        else if (currency === 'BTC') result = await sendBTCViaWC(address, recipient, amount);
      } else {
        // Send via browser extension
        if (currency === 'ETH') result = await sendETHViaExtension(recipient, amount);
        else if (currency === 'TRON') result = await sendTRONViaExtension(recipient, amount);
        else if (currency === 'BTC') result = await sendBTCViaExtension(recipient, amount);
      }

      onSuccess({ hash: result.hash, from: result.from || address, to: recipient, amount, currency });
    } catch (err) {
      onError(err.message);
    } finally { setSending(false); }
  };

  if (!connected) {
    return (
      <div className="method-card">
        <QRModal show={showQR} uri={wcUri} title="Scan to Connect"
          hint={`Connect your wallet for ${currency}. Supports Trust Wallet, MetaMask Mobile, Coinbase, and 520+ wallets.`}
          onClose={() => setShowQR(false)} />

        <h3>Connect Wallet</h3>
        <p className="method-desc">Connect via WalletConnect (any mobile wallet) or a browser extension.</p>

        <div className="method-buttons">
          {/* WalletConnect — available for ETH, TRON, and BTC */}
          <button className="btn connect-btn walletconnect-btn" onClick={connectViaWC}>
            <span>📱</span> WalletConnect ({currency})
          </button>

          {/* Browser extensions */}
          {currency === 'ETH' && isETHWalletInstalled() && (
            <button className="btn connect-btn metamask" onClick={() => connectViaExtension('eth')}>
              <HiLightningBolt /> {getETHWalletName()}
            </button>
          )}
          {currency === 'TRON' && isTronLinkInstalled() && (
            <button className="btn connect-btn tronlink" onClick={() => connectViaExtension('tron')}>
              <HiLightningBolt /> TronLink
            </button>
          )}
          {currency === 'BTC' && isBTCWalletInstalled() && (
            <button className="btn connect-btn btc-btn" onClick={() => connectViaExtension('btc')}>
              <HiLightningBolt /> {getBTCWalletName()}
            </button>
          )}

          {/* Helpful messages */}
          {currency === 'TRON' && !isTronLinkInstalled() && (
            <p className="method-unavailable">No TronLink extension? Use WalletConnect above.</p>
          )}
          {currency === 'BTC' && !isBTCWalletInstalled() && (
            <p className="method-unavailable">No UniSat/Xverse extension? Use WalletConnect above.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="method-card active">
      <div className="connected-badge"><HiCheckCircle /> {walletName}: {address.slice(0, 10)}...{address.slice(-6)}</div>
      <div className="form-group">
        <label>Recipient Address</label>
        <input type="text" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={`Enter ${currency} address`} />
      </div>
      <div className="form-group">
        <label>Amount ({currency})</label>
        <input type="number" step="any" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
      </div>
      <button className="btn btn-success btn-full" onClick={handleSend} disabled={sending || !recipient || !amount}>
        <HiLightningBolt /> {sending ? 'Sending...' : `Send ${amount || '0'} ${currency}`}
      </button>
    </div>
  );
}
