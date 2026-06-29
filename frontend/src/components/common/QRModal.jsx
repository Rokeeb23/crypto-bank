import { QRCodeSVG } from 'qrcode.react';
import { HiX } from 'react-icons/hi';

export default function QRModal({ show, uri, title, hint, onClose }) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal qr-modal" onClick={e => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h2>{title || 'Scan with Wallet'}</h2>
          <button className="btn-icon" onClick={onClose}><HiX size={20} /></button>
        </div>
        <div className="qr-container">
          {uri ? (
            <QRCodeSVG value={uri} size={280} bgColor="#ffffff" fgColor="#000000" level="M" includeMargin />
          ) : (
            <div className="qr-loading"><div className="sending-spinner" />Connecting...</div>
          )}
        </div>
        <p className="qr-hint">{hint || 'Scan with your wallet app.'}</p>
      </div>
    </div>
  );
}
