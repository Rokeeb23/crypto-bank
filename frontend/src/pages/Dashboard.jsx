import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { walletAPI, transactionAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { HiArrowUp, HiArrowDown, HiClock, HiCheckCircle } from 'react-icons/hi';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { user } = useAuth();
  const [balances, setBalances] = useState([]);
  const [prices, setPrices] = useState({});
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [balRes, priceRes, txRes] = await Promise.all([
        walletAPI.getBalances().catch(() => ({ data: { balances: [] } })),
        walletAPI.getPrices().catch(() => ({ data: { prices: {} } })),
        transactionAPI.list({ limit: 5 }).catch(() => ({ data: { transactions: [] } })),
      ]);
      setBalances(balRes.data.balances || []);
      setPrices(priceRes.data.prices || {});
      setRecentTx(txRes.data.transactions || []);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getTotalUSD = () => {
    return balances.reduce((total, w) => {
      const balance = parseFloat(w.balance_data?.balance || 0);
      const price = prices[w.currency]?.usd || 0;
      return total + (balance * price);
    }, 0);
  };

  const currencyIcons = { BTC: '₿', ETH: 'Ξ', TRON: '◈' };
  const currencyColors = { BTC: '#f7931a', ETH: '#627eea', TRON: '#ff0013' };

  const statusIcon = (status) => {
    switch (status) {
      case 'confirmed': return <HiCheckCircle className="status-icon confirmed" />;
      case 'pending': return <HiClock className="status-icon pending" />;
      case 'authorized': return <HiClock className="status-icon authorized" />;
      default: return <HiClock className="status-icon" />;
    }
  };

  if (loading) return <div className="loading-screen">Loading dashboard...</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Welcome, {user?.full_name}</h1>
        <p>Your crypto portfolio at a glance</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card total">
          <span className="stat-label">Total Portfolio Value</span>
          <span className="stat-value">${getTotalUSD().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Linked Wallets</span>
          <span className="stat-value">{balances.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Recent Transactions</span>
          <span className="stat-value">{recentTx.length}</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h2>Wallet Balances</h2>
            <Link to="/wallets" className="btn btn-sm">Manage</Link>
          </div>
          {balances.length === 0 ? (
            <div className="empty-state">
              <p>No wallets linked yet</p>
              <Link to="/wallets" className="btn btn-primary btn-sm">Link Wallet</Link>
            </div>
          ) : (
            <div className="balance-list">
              {balances.map((w) => (
                <div key={w.id} className="balance-item">
                  <div className="balance-info">
                    <span className="currency-icon" style={{ background: currencyColors[w.currency] }}>
                      {currencyIcons[w.currency]}
                    </span>
                    <div>
                      <strong>{w.currency}</strong>
                      <span className="wallet-label">{w.label || w.address.slice(0, 12) + '...'}</span>
                    </div>
                  </div>
                  <div className="balance-amount">
                    <strong>{parseFloat(w.balance_data?.balance || 0).toFixed(6)}</strong>
                    <span className="usd-value">
                      ${(parseFloat(w.balance_data?.balance || 0) * (prices[w.currency]?.usd || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Market Prices</h2>
          </div>
          <div className="price-list">
            {Object.entries(prices).map(([currency, data]) => (
              <div key={currency} className="price-item">
                <div className="price-info">
                  <span className="currency-icon" style={{ background: currencyColors[currency] }}>
                    {currencyIcons[currency]}
                  </span>
                  <strong>{currency}</strong>
                </div>
                <div className="price-amount">
                  <strong>${(data.usd || 0).toLocaleString()}</strong>
                  <span className={`change ${data.change_24h >= 0 ? 'positive' : 'negative'}`}>
                    {data.change_24h >= 0 ? '+' : ''}{(data.change_24h || 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card full-width">
          <div className="card-header">
            <h2>Recent Transactions</h2>
            <Link to="/transactions" className="btn btn-sm">View All</Link>
          </div>
          {recentTx.length === 0 ? (
            <div className="empty-state">
              <p>No transactions yet</p>
              <Link to="/send" className="btn btn-primary btn-sm">Send Crypto</Link>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Currency</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTx.map(tx => (
                    <tr key={tx.id}>
                      <td>
                        <span className={`tx-type ${tx.tx_type}`}>
                          {tx.tx_type === 'send' ? <HiArrowUp /> : <HiArrowDown />}
                          {tx.tx_type}
                        </span>
                      </td>
                      <td>{tx.currency}</td>
                      <td>{parseFloat(tx.amount).toFixed(6)}</td>
                      <td>
                        <span className={`status-badge ${tx.status}`}>
                          {statusIcon(tx.status)} {tx.status}
                        </span>
                      </td>
                      <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
