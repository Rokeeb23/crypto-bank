import { useState, useEffect } from 'react';
import { walletAPI } from '../services/api';
import {
  connectWalletConnect, getConnectedAccounts, isConnected, disconnect,
  connectETHExtension, connectTronLinkExtension, connectBTCExtension,
  isETHWalletInstalled, isTronLinkInstalled, isBTCWalletInstalled,
  getETHWalletName, getBTCWalletName
} from '../services/web3';
import { HiPlus, HiTrash, HiClipboardCopy, HiShieldCheck, HiLink, HiX } from 'react-icons/hi';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';

export default function Wallets() {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [wcUri, setWcUri] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [form, setForm] = useState({ currency: 'BTC', address: '', label: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => { loadWallets(); }, []);

  const loadWallets = async () => {
    try {
      const { data } = await walletAPI.list();
      setWallets(data.wallets || []);
    } catch { toast.error('Failed to load wallets'); }
    finally { setLoading(false); }
  };

  const linkWallet = async (currency, address, label) => {
    try {
      const { data } = await walletAPI.add({ currency, address, label });
      toast.success(`${currency} wallet linked! Balance: ${data.wallet.verified_balance} ${currency}`, { duration: 4000 });
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to link';
      if (msg.includes('already linked')) {
        // Not an error, just skip
        return true;
      }
      toast.error(msg);
      return false;
    }
  };

  // Main connect — one QR, all chains
  const handleWalletConnect = async () => {
    setConnecting(true);
    setShowQR(true);
    setWcUri('');
    try {
      const accounts = await connectWalletConnect((uri) => setWcUri(uri));
      setShowQR(false);

      let linked = 0;

      if (accounts.eth) {
        const ok = await linkWallet('ETH', accounts.eth, accounts.wallet);
        if (ok) linked++;
      }
      if (accounts.tron) {
        const ok = await linkWallet('TRON', accounts.tron, accounts.wallet);
        if (ok) linked++;
      }
      if (accounts.btc) {
        const ok = await linkWallet('BTC', accounts.btc, accounts.wallet);
        if (ok) linked++;
      }

      if (linked > 0) {
        toast.success(`${accounts.wallet} connected! ${linked} wallet(s) linked.`, { duration: 5000 });
        loadWallets();
        setShowAdd(false);
      } else if (!accounts.eth && !accounts.tron && !accounts.btc) {
        toast.error('No accounts returned from wallet.');
      }
    } catch (err) {
      setShowQR(false);
      if (!err.message?.includes('rejected') && !err.message?.includes('User')) {
        toast.error(err.message || 'Connection failed');
      }
    } finally { setConnecting(false); }
  };

  // Extension connect shortcuts
  const handleExtension = async (type) => {
    setConnecting(true);
    try {
      let result;
      if (type === 'eth') result = await connectETHExtension();
      else if (type === 'tron') result = await connectTronLinkExtension();
      else if (type === 'btc') result = await connectBTCExtension();

      const currency = type === 'eth' ? 'ETH' : type === 'tron' ? 'TRON' : 'BTC';
      toast.success(`${result.wallet} connected!`);
      await linkWallet(currency, result.address, result.wallet);
      loadWallets();
      setShowAdd(false);
    } catch (err) {
      toast.error(err.message);
    } finally { setConnecting(false); }
  };

  // Manual paste
  const handleManualAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    await linkWallet(form.currency, form.address, form.label);
    setForm({ currency: 'BTC', address: '', label: '' });
    loadWallets();
    setAdding(false);
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this wallet?')) return;
    try { await walletAPI.remove(id); toast.success('Removed'); loadWallets(); }
    catch { toast.error('Failed'); }
  };

  const copyAddress = (a) => { navigator.clipboard.writeText(a); toast.success('Copied!'); };

  const currencyColors = { BTC: '#f7931a', ETH: '#627eea', TRON: '#ff0013' };
  const currencyIcons = { BTC: '₿', ETH: 'Ξ', TRON: '◈' };
  const placeholders = {
    BTC: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    ETH: '0x742d35Cc6634C0532925a3b...',
    TRON: 'TJCnKsPa7y5okkXvQAidZBzqx3QyQ6sxMW'
  };

  if (loading) return <div className="loading-screen">Loading wallets...</div>;

  return (
    <div className="page-container">
      {/* WalletConnect QR Modal */}
      {showQR && (
        <div className="modal-overlay" onClick={() => { setShowQR(false); setConnecting(false); }}>
          <div className="modal qr-modal" onClick={e => e.stopPropagation()}>
            <div className="qr-modal-header">
              <h2>Scan with Wallet</h2>
              <button className="btn-icon" onClick={() => { setShowQR(false); setConnecting(false); }}><HiX size={20} /></button>
            </div>
            <div className="qr-container">
              {wcUri ? <QRCodeSVG value={wcUri} size={280} bgColor="#ffffff" fgColor="#000000" level="M" includeMargin />
                : <div className="qr-loading"><div className="sending-spinner" />Connecting to relay...</div>}
            </div>
            <p className="qr-hint">
              Scan with Trust Wallet, Coinbase, MetaMask Mobile, Rainbow, or any WalletConnect wallet.
              <br /><strong>All supported chains (ETH, TRON) will connect at once.</strong>
            </p>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1>My Wallets</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}><HiPlus /> Link Wallet</button>
      </div>

      {showAdd && (
        <div className="card add-wallet-card">
          <h3>Connect Wallet</h3>

          {/* WalletConnect — the main button */}
          <div className="connect-section">
            <label className="section-label">Connect via WalletConnect (all chains)</label>
            <button
              className="btn connect-btn walletconnect-btn btn-full"
              onClick={handleWalletConnect}
              disabled={connecting}
              style={{ padding: '16px', fontSize: '16px' }}
            >
              <span>📱</span> {connecting ? 'Connecting...' : 'Scan QR — Connect ETH, TRON & more'}
            </button>
            <p className="connect-hint">
              One scan connects all chains your wallet supports. Works with Trust Wallet, MetaMask Mobile, Coinbase, Rainbow, and 520+ wallets.
            </p>
          </div>

          {/* Browser extension shortcuts */}
          {(isETHWalletInstalled() || isTronLinkInstalled() || isBTCWalletInstalled()) && (
            <div className="connect-section">
              <label className="section-label">Or connect browser extension</label>
              <div className="connect-buttons-grid">
                {isETHWalletInstalled() && (
                  <button className="btn connect-btn metamask" onClick={() => handleExtension('eth')} disabled={connecting}>
                    <HiLink /> {getETHWalletName()} (ETH)
                  </button>
                )}
                {isTronLinkInstalled() && (
                  <button className="btn connect-btn tronlink" onClick={() => handleExtension('tron')} disabled={connecting}>
                    <HiLink /> TronLink (TRON)
                  </button>
                )}
                {isBTCWalletInstalled() && (
                  <button className="btn connect-btn btc-btn" onClick={() => handleExtension('btc')} disabled={connecting}>
                    <HiLink /> {getBTCWalletName()} (BTC)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Manual paste */}
          <div className="divider-text"><span>or paste address manually</span></div>
          <form onSubmit={handleManualAdd}>
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
                <label>Label</label>
                <input type="text" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="My wallet" />
              </div>
            </div>
            <div className="form-group">
              <label>Address</label>
              <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder={placeholders[form.currency]} required />
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
          <p>Connect your wallet to see live balances and send real crypto.</p>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><HiPlus /> Connect Wallet</button>
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
