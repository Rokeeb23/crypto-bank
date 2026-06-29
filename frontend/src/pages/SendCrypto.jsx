import { useState, useEffect } from 'react';
import { walletAPI, transactionAPI } from '../services/api';
import ExtensionSend from '../components/send/ExtensionSend';
import KeySend from '../components/send/KeySend';
import PaymentQRSend from '../components/send/PaymentQRSend';
import { Link } from 'react-router-dom';
import { HiLightningBolt, HiKey, HiQrcode, HiCheckCircle, HiExternalLink } from 'react-icons/hi';
import toast from 'react-hot-toast';

export default function SendCrypto() {
  const [wallets, setWallets] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [method, setMethod] = useState('extension');
  const [result, setResult] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [walletRes, priceRes] = await Promise.all([walletAPI.list(), walletAPI.getPrices()]);
      setWallets(walletRes.data.wallets || []);
      setPrices(priceRes.data.prices || {});
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  const selectedWallet = wallets.find(w => w.id == selectedWalletId);

  const handleSuccess = async (txData) => {
    try {
      if (!txData.id) {
        const { data: createData } = await transactionAPI.create({
          wallet_id: selectedWalletId,
          recipient_address: txData.to,
          amount: txData.amount,
          note: ''
        });
        await transactionAPI.authorize(createData.transaction.id);
        await transactionAPI.confirm(createData.transaction.id, txData.hash);
      }
    } catch {}

    setResult(txData);
    toast.success('Transaction sent!', { duration: 5000 });
  };

  const handleError = (msg) => {
    if (msg.includes('rejected') || msg.includes('denied')) {
      toast.error('Transaction rejected in wallet.');
    } else {
      toast.error(msg);
    }
  };

  const getExplorerUrl = (currency, hash) => {
    if (currency === 'BTC') return `https://www.blockchain.com/btc/tx/${hash}`;
    if (currency === 'ETH') return `https://etherscan.io/tx/${hash}`;
    if (currency === 'TRON') return `https://tronscan.org/#/transaction/${hash}`;
    return '#';
  };

  const resetAll = () => { setResult(null); setSelectedWalletId(''); };

  if (loading) return <div className="loading-screen">Loading...</div>;
  if (wallets.length === 0) return (
    <div className="page-container"><div className="card empty-state-large">
      <h3>No wallets linked</h3><p>Link a wallet first.</p>
      <Link to="/wallets" className="btn btn-primary">Link Wallet</Link>
    </div></div>
  );

  // Success screen
  if (result) {
    return (
      <div className="page-container">
        <div className="card send-card authorize-card">
          <div className="authorize-icon success"><HiCheckCircle size={56} /></div>
          <h2>Sent!</h2>
          <p>{result.amount} {result.currency} sent successfully.</p>
          {result.hash && (
            <div className="tx-hash-display">
              <label>Transaction Hash</label>
              <a href={getExplorerUrl(result.currency, result.hash)} target="_blank" rel="noopener noreferrer" className="mono">
                {result.hash} <HiExternalLink />
              </a>
            </div>
          )}
          <div className="form-actions" style={{ justifyContent: 'center', marginTop: '20px' }}>
            <button className="btn btn-primary" onClick={resetAll}>Send More</button>
            <Link to="/transactions" className="btn btn-secondary">View History</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Send Crypto</h1>
      </div>

      {/* Step 1: Pick wallet */}
      <div className="card">
        <div className="form-group">
          <label>From Wallet</label>
          <select value={selectedWalletId} onChange={e => { setSelectedWalletId(e.target.value); setResult(null); }}>
            <option value="">Select a wallet</option>
            {wallets.map(w => (
              <option key={w.id} value={w.id}>{w.currency} — {w.label || w.address.slice(0, 24) + '...'}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Step 2: Pick method */}
      {selectedWallet && (
        <>
          <div className="method-tabs">
            <button className={`method-tab ${method === 'extension' ? 'active' : ''}`} onClick={() => setMethod('extension')}>
              <HiLightningBolt /> Wallet Extension
            </button>
            <button className={`method-tab ${method === 'key' ? 'active' : ''}`} onClick={() => setMethod('key')}>
              <HiKey /> Private Key
            </button>
            <button className={`method-tab ${method === 'qr' ? 'active' : ''}`} onClick={() => setMethod('qr')}>
              <HiQrcode /> Payment QR
            </button>
          </div>

          {/* Step 3: Method-specific UI */}
          {method === 'extension' && (
            <ExtensionSend currency={selectedWallet.currency} onSuccess={handleSuccess} onError={handleError} />
          )}
          {method === 'key' && (
            <KeySend currency={selectedWallet.currency} walletId={selectedWallet.id} onSuccess={handleSuccess} onError={handleError} />
          )}
          {method === 'qr' && (
            <PaymentQRSend
              currency={selectedWallet.currency}
              senderAddress={selectedWallet.address}
              walletId={selectedWallet.id}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          )}
        </>
      )}
    </div>
  );
}
