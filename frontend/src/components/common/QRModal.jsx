import { QRCodeSVG } from 'qrcode.react';
import { HiX, HiExternalLink } from 'react-icons/hi';
import { isMobile, getDeepLink, getWalletList } from '../../services/web3';

export default function QRModal({ show, uri, title, hint, onClose }) {
  if (!show) return null;

  const mobile = isMobile();
  const wallets = getWalletList();

  const openWallet = (walletId) => {
    const link = getDeepLink(walletId, uri);
    if (link) window.location.href = link;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal qr-modal" onClick={e => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h2>{mobile ? 'Open Wallet' : (title || 'Scan with Wallet')}</h2>
          <button className="btn-icon" onClick={onClose}><HiX size={20} /></button>
        </div>

        {!uri && (
          <div className="qr-container">
            <div className="qr-loading"><div className="sending-spinner" />Connecting...</div>
          </div>
        )}

        {uri && !mobile && (
          <>
            <div className="qr-container">
              <QRCodeSVG value={uri} size={280} bgColor="#ffffff" fgColor="#000000" level="M" includeMargin />
            </div>
            <p className="qr-hint">{hint || 'Scan with your wallet app.'}</p>
          </>
        )}

        {uri && mobile && (
          <div className="wallet-deeplinks">
            <p className="qr-hint">Tap your wallet to connect:</p>
            {wallets.map(w => (
              <button key={w.id} className="btn wallet-link-btn" onClick={() => openWallet(w.id)}>
                <span>{w.name}</span>
                <HiExternalLink />
              </button>
            ))}
            <div className="deeplink-divider">
              <span>or copy link manually</span>
            </div>
            <button className="btn btn-secondary btn-full" onClick={() => { navigator.clipboard.writeText(uri); }}>
              Copy Connection Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
