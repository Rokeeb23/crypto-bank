import { useState, useEffect } from 'react';
import { walletAPI } from '../services/api';
import {
  connectETHWallet, connectETHWalletConnect, connectTronLink, connectBTCWallet,
  isETHWalletInstalled, isTronLinkInstalled, isBTCWalletInstalled,
  getETHWalletName, getBTCWalletName, setActiveETHMethod
} from '../services/web3';
import { HiPlus, HiTrash, HiClipboardCopy, HiShieldCheck, HiLink, HiX } from 'react-icons/hi';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';

export default function Wallets() {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ currency: 'BTC', address: '', label: '' });
  const [adding, setAdding] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [wcUri, setWcUri] = useState('');
  const [showQR, setShowQR] = useState(false);

  useEffect(() => { loadWallets(); }, []);

  const loadWallets = async () => {
    try {
      const { data } = await walletAPI.list();
      setWallets(data.wallets || []);
    } catch { toast.error('Failed to load wallets'); }
    finally { setLoading(false); }
  };

  const linkWallet = async (currency, address, label) => {
    setAdding(true);
    try {
      const { data } = await walletAPI.add({ currency, address, label });
      toast.success(`Wallet linked! Balance: ${data.wallet.verified_balance} ${currency}`, { duration: 5000 });
      setShowAdd(false);
      setForm({ currency: 'BTC', address: '', label: '' });
      loadWallets();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to link wallet');
    } finally { setAdding(false); }
  };

  const handleConnect = async (method) => {
    setConnecting(true);
    try {
      let result;
      switch (method) {
        case 'eth-browser':
          result = await connectETHWallet();
          setActiveETHMethod('browser');
          break;
        case 'eth-wc':
          setShowQR(true); setWcUri('');
          result = await connectETHWalletConnect((uri) => setWcUri(uri));
          setShowQR(false);
          setActiveETHMethod('walletconnect');
          break;
        case 'tron-browser':
          result = await connectTronLink();
          break;
        case 'btc-browser':
          result = await connectBTCWallet();
          break;
      }
      toast.success(`${result.wallet} connected! Verifying...`);
      const currency = method.startsWith('eth') ? 'ETH' : method.startsWith('tron') ? 'TRON' : 'BTC';
      await linkWallet(currency, result.address, result.wallet);
    } catch (err) {
      setShowQR(false); setWcUri('');
      if (!err.message?.includes('rejected') && !err.message?.includes('reset')) {
        toast.error(err.message || 'Connection failed');
      }
    } finally { setConnecting(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    await linkWallet(form.currency, form.address, form.label);
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this wallet?')) return;
    try { await walletAPI.remove(id); toast.success('Wallet removed'); loadWallets(); }
    catch { toast.error('Failed to remove'); }
  };

  const copyAddress = (addr) => { navigator.clipboard.writeText(addr); toast.success('Copied!'); };

  const currencyColors = { BTC: '#f7931a', ETH: '#627eea', TRON: '#ff0013' };
  const currencyIcons = { BTC: '₿', ETH: 'Ξ', TRON: '◈' };
  const currencyNames = { BTC: 'Bitcoin', ETH: 'Ethereum', TRON: 'TRON' };
  const placeholders = {
    BTC: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    ETH: '0x742d35Cc6634C0532925a3b844Bc9e7595f...',
    TRON: 'TJCnKsPa7y5okkXvQAidZBzqx3QyQ6sxMW'
  };

  if (loading) return <div className="loading-screen">Loading wallets...</div>;

  return (
    <div className="page-container">
      {showQR && (
        <div className="modal-overlay" onClick={() => { setShowQR(false); setConnecting(false); }}>
          <div className="modal qr-modal" onClick={e => e.stopPropagation()}>
            <div className="qr-modal-header">
              <h2>Scan with Wallet</h2>
              <button className="btn-icon" onClick={() => { setShowQR(false); setConnecting(false); }}><HiX size={20} /></button>
            </div>
            <div className="qr-container">
              {wcUri ? <QRCodeSVG value={wcUri} size={280} bgColor="#ffffff" fgColor="#000000" level="M" includeMargin />
                : <div className="qr-loading"><div className="sending-spinner" />Connecting...</div>}
            </div>
            <p className="qr-hint">Scan with Trust Wallet, Coinbase, Rainbow, or any WalletConnect wallet.</p>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1>My Wallets</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}><HiPlus /> Link Wallet</button>
      </div>

      {showAdd && (
        <div className="card add-wallet-card">
          <h3>Link Wallet</h3>

          {/* ETH */}
          <div className="connect-section">
            <label className="section-label">Ethereum (ETH)</label>
            <div className="connect-buttons-grid">
              {isETHWalletInstalled() && (
                <button className="btn connect-btn metamask" onClick={() => handleConnect('eth-browser')} disabled={connecting}>
                  <HiLink /> {getETHWalletName()}
                </button>
              )}
              <button className="btn connect-btn walletconnect-btn" onClick={() => handleConnect('eth-wc')} disabled={connecting}>
                <span>📱</span> WalletConnect QR
              </button>
            </div>
          </div>

          {/* TRON */}
          <div className="connect-section">
            <label className="section-label">TRON (TRX)</label>
            <div className="connect-buttons-grid">
              {isTronLinkInstalled() && (
                <button className="btn connect-btn tronlink" onClick={() => handleConnect('tron-browser')} disabled={connecting}>
                  <HiLink /> TronLink
                </button>
              )}
            </div>
            <p className="connect-hint">Paste your TRON address below to link. Open your Trust Wallet or TronLink app to find your TRX address.</p>
          </div>

          {/* BTC */}
          <div className="connect-section">
            <label className="section-label">Bitcoin (BTC)</label>
            <div className="connect-buttons-grid">
              {isBTCWalletInstalled() && (
                <button className="btn connect-btn btc-btn" onClick={() => handleConnect('btc-browser')} disabled={connecting}>
                  <HiLink /> {getBTCWalletName()}
                </button>
              )}
            </div>
            <p className="connect-hint">Paste your BTC address below to link. Open your Trust Wallet, Coinbase, or any Bitcoin wallet to find your BTC address.</p>
          </div>

          <div className="divider-text"><span>paste wallet address</span></div>

          <form onSubmit={handleAdd}>
            <div className="form-row">
              <div className="form-group">
                <label>Cryptocurrency</label>
                <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value, address: '' })}>
                  <option value="BTC">Bitcoin (BTC)</option>
                  <option value="ETH">Ethereum (ETH)</option>
                  <option value="TRON">TRON (TRX)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Label (optional)</label>
                <input type="text" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="My main wallet" />
              </div>
            </div>
            <div className="form-group">
              <label>Wallet Address</label>
              <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder={placeholders[form.currency]} required />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                <HiShieldCheck style={{ verticalAlign: 'middle' }} /> Verified on the live {currencyNames[form.currency]} mainnet.
              </span>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={adding || !form.address}>
                {adding ? 'Verifying...' : 'Verify & Link'}
              </button>
            </div>
          </form>
        </div>
      )}

      {wallets.length === 0 ? (
        <div className="card empty-state-large">
          <h3>No wallets linked</h3>
          <p>Connect your crypto wallet to see live balances and send real crypto.</p>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><HiPlus /> Link Your First Wallet</button>
        </div>
      ) : (
        <div className="wallet-grid">
          {wallets.map(wallet => (
            <div key={wallet.id} className="wallet-card">
              <div className="wallet-header">
                <span className="currency-icon" style={{ background: currencyColors[wallet.currency] }}>{currencyIcons[wallet.currency]}</span>
                <div><strong>{wallet.currency}</strong>{wallet.label && <span className="wallet-label">{wallet.label}</span>}</div>
                {wallet.is_primary === 1 && <span className="badge-primary">Primary</span>}
              </div>
              <div className="wallet-address">
                <code>{wallet.address}</code>
                <button className="btn-icon" onClick={() => copyAddress(wallet.address)}><HiClipboardCopy /></button>
              </div>
              <div className="wallet-actions">
                <span className="wallet-date">Linked {new Date(wallet.created_at).toLocaleDateString()}</span>
                <button className="btn-icon danger" onClick={() => handleRemove(wallet.id)}><HiTrash /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
