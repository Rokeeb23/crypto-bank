import { useState } from 'react';
import { HiLightningBolt, HiCheckCircle } from 'react-icons/hi';
import {
  connectETHWallet, connectETHWalletConnect, connectTronLink, connectBTCWallet,
  sendETH, sendTRONViaExtension, sendBTCViaExtension, setActiveETHMethod,
  isETHWalletInstalled, isTronLinkInstalled, isBTCWalletInstalled,
  getETHWalletName, getBTCWalletName
} from '../../services/web3';
import QRModal from '../common/QRModal';
import toast from 'react-hot-toast';

export default function ExtensionSend({ currency, onSuccess, onError }) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [walletName, setWalletName] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [wcUri, setWcUri] = useState('');
  const [showQR, setShowQR] = useState(false);

  const connect = async (method) => {
    try {
      let result;
      if (method === 'eth') { result = await connectETHWallet(); setActiveETHMethod('browser'); }
      else if (method === 'eth-wc') {
        setShowQR(true); setWcUri('');
        result = await connectETHWalletConnect((uri) => setWcUri(uri));
        setShowQR(false); setActiveETHMethod('walletconnect');
      }
      else if (method === 'tron') { result = await connectTronLink(); }
      else if (method === 'btc') { result = await connectBTCWallet(); }
      setAddress(result.address);
      setWalletName(result.wallet);
      setConnected(true);
      toast.success(`${result.wallet} connected!`);
    } catch (err) {
      setShowQR(false);
      toast.error(err.message);
    }
  };

  const handleSend = async () => {
    if (!recipient || !amount) { toast.error('Enter recipient and amount'); return; }
    setSending(true);
    try {
      let result;
      if (currency === 'ETH') result = await sendETH(recipient, amount);
      else if (currency === 'TRON') result = await sendTRONViaExtension(recipient, amount);
      else if (currency === 'BTC') result = await sendBTCViaExtension(recipient, amount);
      onSuccess({ hash: result.hash, from: result.from || address, to: recipient, amount, currency });
    } catch (err) {
      onError(err.message);
    } finally { setSending(false); }
  };

  if (!connected) {
    return (
      <div className="method-card">
        <QRModal show={showQR} uri={wcUri} title="Scan with Wallet"
          hint="Scan with Trust Wallet, Coinbase, Rainbow, etc."
          onClose={() => setShowQR(false)} />

        <h3>Connect Wallet Extension</h3>
        <p className="method-desc">One-click sending from your browser wallet.</p>
        <div className="method-buttons">
          {currency === 'ETH' && isETHWalletInstalled() && (
            <button className="btn connect-btn metamask" onClick={() => connect('eth')}><HiLightningBolt /> {getETHWalletName()}</button>
          )}
          {currency === 'ETH' && (
            <button className="btn connect-btn walletconnect-btn" onClick={() => connect('eth-wc')}><span>📱</span> WalletConnect QR</button>
          )}
          {currency === 'TRON' && isTronLinkInstalled() && (
            <button className="btn connect-btn tronlink" onClick={() => connect('tron')}><HiLightningBolt /> TronLink</button>
          )}
          {currency === 'BTC' && isBTCWalletInstalled() && (
            <button className="btn connect-btn btc-btn" onClick={() => connect('btc')}><HiLightningBolt /> {getBTCWalletName()}</button>
          )}
          {currency === 'TRON' && !isTronLinkInstalled() && <p className="method-unavailable">TronLink extension not detected.</p>}
          {currency === 'BTC' && !isBTCWalletInstalled() && <p className="method-unavailable">UniSat/Xverse not detected.</p>}
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
