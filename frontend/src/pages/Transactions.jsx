import { useState, useEffect } from 'react';
import { transactionAPI } from '../services/api';
import { HiArrowUp, HiArrowDown, HiSearch, HiExternalLink } from 'react-icons/hi';
import toast from 'react-hot-toast';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ currency: '', status: '', page: 1 });
  const [selectedTx, setSelectedTx] = useState(null);

  useEffect(() => { loadTransactions(); }, [filters]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const { data } = await transactionAPI.list(filters);
      setTransactions(data.transactions || []);
      setPagination(data.pagination || { page: 1, pages: 1 });
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const getExplorerUrl = (currency, txHash) => {
    if (!txHash) return null;
    switch (currency) {
      case 'BTC': return `https://www.blockchain.com/btc/tx/${txHash}`;
      case 'ETH': return `https://etherscan.io/tx/${txHash}`;
      case 'TRON': return `https://tronscan.org/#/transaction/${txHash}`;
      default: return null;
    }
  };

  const statusColors = {
    pending: '#f59e0b',
    authorized: '#3b82f6',
    confirmed: '#10b981',
    failed: '#ef4444',
    rejected: '#6b7280'
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Transaction History</h1>
      </div>

      <div className="card filter-card">
        <div className="filters">
          <select
            value={filters.currency}
            onChange={e => setFilters({ ...filters, currency: e.target.value, page: 1 })}
          >
            <option value="">All Currencies</option>
            <option value="BTC">Bitcoin</option>
            <option value="ETH">Ethereum</option>
            <option value="TRON">TRON</option>
          </select>
          <select
            value={filters.status}
            onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="authorized">Authorized</option>
            <option value="confirmed">Confirmed</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-inline">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <HiSearch size={32} />
            <p>No transactions found</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Currency</th>
                    <th>Amount</th>
                    <th>Recipient</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} onClick={() => setSelectedTx(tx)} className="clickable">
                      <td>#{tx.id}</td>
                      <td>
                        <span className={`tx-type ${tx.tx_type}`}>
                          {tx.tx_type === 'send' ? <HiArrowUp /> : <HiArrowDown />}
                          {tx.tx_type}
                        </span>
                      </td>
                      <td>{tx.currency}</td>
                      <td>{parseFloat(tx.amount).toFixed(6)}</td>
                      <td className="mono">{tx.recipient_address ? tx.recipient_address.slice(0, 16) + '...' : '-'}</td>
                      <td>
                        <span className="status-dot" style={{ background: statusColors[tx.status] }} />
                        {tx.status}
                      </td>
                      <td>{new Date(tx.created_at).toLocaleString()}</td>
                      <td>
                        {tx.tx_hash && (
                          <a
                            href={getExplorerUrl(tx.currency, tx.tx_hash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-icon"
                            onClick={e => e.stopPropagation()}
                            title="View on Explorer"
                          >
                            <HiExternalLink />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                className="btn btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              >
                Previous
              </button>
              <span>Page {pagination.page} of {pagination.pages}</span>
              <button
                className="btn btn-sm"
                disabled={pagination.page >= pagination.pages}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {selectedTx && (
        <div className="modal-overlay" onClick={() => setSelectedTx(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Transaction #{selectedTx.id}</h2>
            <div className="detail-grid">
              <div className="detail-row"><span>Type</span><span>{selectedTx.tx_type}</span></div>
              <div className="detail-row"><span>Currency</span><span>{selectedTx.currency}</span></div>
              <div className="detail-row"><span>Amount</span><span>{parseFloat(selectedTx.amount).toFixed(8)}</span></div>
              <div className="detail-row"><span>From</span><span className="mono">{selectedTx.sender_address}</span></div>
              <div className="detail-row"><span>To</span><span className="mono">{selectedTx.recipient_address}</span></div>
              <div className="detail-row"><span>Status</span><span className={`status-badge ${selectedTx.status}`}>{selectedTx.status}</span></div>
              {selectedTx.tx_hash && (
                <div className="detail-row">
                  <span>TX Hash</span>
                  <a href={getExplorerUrl(selectedTx.currency, selectedTx.tx_hash)} target="_blank" rel="noopener noreferrer" className="mono">
                    {selectedTx.tx_hash.slice(0, 24)}... <HiExternalLink />
                  </a>
                </div>
              )}
              {selectedTx.note && <div className="detail-row"><span>Note</span><span>{selectedTx.note}</span></div>}
              <div className="detail-row"><span>Created</span><span>{new Date(selectedTx.created_at).toLocaleString()}</span></div>
              {selectedTx.authorized_at && <div className="detail-row"><span>Authorized</span><span>{new Date(selectedTx.authorized_at).toLocaleString()}</span></div>}
            </div>
            <button className="btn btn-secondary btn-full" onClick={() => setSelectedTx(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
