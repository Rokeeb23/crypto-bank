import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { HiQrcode, HiCheckCircle } from 'react-icons/hi';
import { generatePaymentUri } from '../../services/web3';
import { transactionAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function PaymentQRSend({ currency, senderAddress, walletId, onSuccess, onError }) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pendingTxId, setPendingTxId] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const paymentUri = recipient && amount ? generatePaymentUri(currency, recipient, amount) : '';

  const handleGenerate = async () => {
    if (!recipient || !amount) { toast.error('Enter recipient and amount'); return; }

    try {
      // Create and authorize the transaction in the backend
      const { data: createData } = await transactionAPI.create({
        wallet_id: walletId, recipient_address: recipient, amount, note: 'Payment QR send'
      });
      await transactionAPI.authorize(createData.transaction.id);
      setPendingTxId(createData.transaction.id);

      setShowQR(true);
      setPolling(true);
      toast.success('QR generated! Scan from your wallet app. We\'re watching the blockchain...');

      // Start polling the blockchain for the transaction
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await transactionAPI.detect({
            currency,
            from_address: senderAddress,
            to_address: recipient,
            transaction_id: createData.transaction.id
          });

          if (data.found) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setPolling(false);
            toast.success('Transaction detected on blockchain!', { duration: 5000 });
            onSuccess({ hash: data.hash, from: senderAddress, to: recipient, amount, currency });
          }
        } catch {}
      }, 10000); // Check every 10 seconds

      // Stop polling after 10 minutes
      setTimeout(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setPolling(false);
        }
      }, 600000);

    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create transaction');
    }
  };

  if (!showQR) {
    return (
      <div className="method-card">
        <h3><HiQrcode /> Payment QR Code</h3>
        <p className="method-desc">
          Generate a QR code, scan it from any wallet app (Trust Wallet, Coinbase, etc.).
          The app automatically detects your payment on the blockchain — no hash pasting needed.
        </p>
        <div className="form-group">
          <label>Recipient Address</label>
          <input type="text" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={`Enter ${currency} address`} />
        </div>
        <div className="form-group">
          <label>Amount ({currency})</label>
          <input type="number" step="any" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <button className="btn btn-primary btn-full" onClick={handleGenerate} disabled={!recipient || !amount}>
          <HiQrcode /> Generate Payment QR
        </button>
      </div>
    );
  }

  return (
    <div className="method-card active">
      <h3>Scan to Send {amount} {currency}</h3>
      <p className="method-desc">Open your wallet app and scan this QR code to send.</p>

      <div className="qr-container" style={{ margin: '16px auto' }}>
        <QRCodeSVG value={paymentUri} size={240} bgColor="#ffffff" fgColor="#000000" level="M" includeMargin />
      </div>

      <div className="review-details">
        <div className="review-row"><span>Send</span><span><strong>{amount} {currency}</strong></span></div>
        <div className="review-row"><span>To</span><span className="mono">{recipient}</span></div>
      </div>

      {polling && (
        <div className="detect-status">
          <div className="sending-spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
          <span>Watching blockchain for your transaction...</span>
        </div>
      )}

      {!polling && (
        <div className="detect-status success">
          <HiCheckCircle /> Transaction detected!
        </div>
      )}
    </div>
  );
}
