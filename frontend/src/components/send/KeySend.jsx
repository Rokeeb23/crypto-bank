import { useState } from 'react';
import { HiKey, HiExclamationCircle } from 'react-icons/hi';
import { sendAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function KeySend({ currency, walletId, onSuccess, onError }) {
  const [privateKey, setPrivateKey] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleSend = async () => {
    if (!privateKey || !recipient || !amount) { toast.error('Fill all fields'); return; }
    setSending(true);
    try {
      const { data } = await sendAPI.withKey({
        currency, private_key: privateKey, to_address: recipient,
        amount, wallet_id: walletId
      });
      setPrivateKey('');
      onSuccess(data.transaction);
    } catch (err) {
      onError(err.response?.data?.error || err.message || 'Failed');
    } finally { setSending(false); }
  };

  return (
    <div className="method-card">
      <h3><HiKey /> Send with Private Key</h3>
      <p className="method-desc">Paste your private key to sign the transaction. Your key is used once and never stored.</p>

      <div className="key-warning">
        <HiExclamationCircle /> Your private key is sent to the server to sign the transaction.
        Only use this on trusted networks. The key is never saved.
      </div>

      <div className="form-group">
        <label>Recipient Address</label>
        <input type="text" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={`Enter ${currency} address`} />
      </div>
      <div className="form-group">
        <label>Amount ({currency})</label>
        <input type="number" step="any" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
      </div>
      <div className="form-group">
        <label>Private Key</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={privateKey}
            onChange={e => setPrivateKey(e.target.value)}
            placeholder="Paste your private key"
            style={{ paddingRight: '70px' }}
          />
          <button
            type="button"
            className="btn btn-sm"
            style={{ position: 'absolute', right: '4px', top: '4px' }}
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <button className="btn btn-warning btn-full" onClick={handleSend} disabled={sending || !privateKey || !recipient || !amount}>
        <HiKey /> {sending ? 'Signing & Sending...' : `Sign & Send ${amount || '0'} ${currency}`}
      </button>
    </div>
  );
}
