import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { HiUsers, HiCollection, HiSwitchHorizontal, HiClock, HiSearch } from 'react-icons/hi';
import toast from 'react-hot-toast';

export default function Admin() {
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });

  useEffect(() => {
    if (tab === 'stats') loadStats();
    else if (tab === 'users') loadUsers();
    else if (tab === 'transactions') loadTransactions();
  }, [tab]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getStats();
      setStats(data);
    } catch {
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getUsers({ page, search });
      setUsers(data.users || []);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getAllTransactions({ page });
      setTransactions(data.transactions || []);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userId, updates) => {
    try {
      await adminAPI.updateUser({ user_id: userId, ...updates });
      toast.success('User updated');
      loadUsers(pagination.page);
    } catch {
      toast.error('Failed to update user');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Admin Panel</h1>
      </div>

      <div className="tab-bar">
        {[
          { id: 'stats', label: 'Overview', icon: <HiCollection /> },
          { id: 'users', label: 'Users', icon: <HiUsers /> },
          { id: 'transactions', label: 'Transactions', icon: <HiSwitchHorizontal /> },
        ].map(t => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-inline">Loading...</div>
      ) : (
        <>
          {tab === 'stats' && stats && (
            <div>
              <div className="stats-grid">
                <div className="stat-card">
                  <HiUsers size={24} />
                  <span className="stat-label">Total Users</span>
                  <span className="stat-value">{stats.stats.total_users}</span>
                </div>
                <div className="stat-card">
                  <HiCollection size={24} />
                  <span className="stat-label">Total Wallets</span>
                  <span className="stat-value">{stats.stats.total_wallets}</span>
                </div>
                <div className="stat-card">
                  <HiSwitchHorizontal size={24} />
                  <span className="stat-label">Total Transactions</span>
                  <span className="stat-value">{stats.stats.total_transactions}</span>
                </div>
                <div className="stat-card warning">
                  <HiClock size={24} />
                  <span className="stat-label">Pending</span>
                  <span className="stat-value">{stats.stats.pending_transactions}</span>
                </div>
              </div>

              <div className="card">
                <h3>Recent Transactions</h3>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr><th>ID</th><th>User</th><th>Currency</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                      {(stats.recent_transactions || []).map(tx => (
                        <tr key={tx.id}>
                          <td>#{tx.id}</td>
                          <td>{tx.full_name}</td>
                          <td>{tx.currency}</td>
                          <td>{parseFloat(tx.amount).toFixed(6)}</td>
                          <td><span className={`status-badge ${tx.status}`}>{tx.status}</span></td>
                          <td>{new Date(tx.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div>
              <div className="card filter-card">
                <div className="search-bar">
                  <HiSearch />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search users by name or email..."
                    onKeyDown={e => e.key === 'Enter' && loadUsers(1)}
                  />
                  <button className="btn btn-sm" onClick={() => loadUsers(1)}>Search</button>
                </div>
              </div>

              <div className="card">
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td>#{u.id}</td>
                          <td>{u.full_name}</td>
                          <td>{u.email}</td>
                          <td>
                            <select
                              value={u.role}
                              onChange={e => updateUser(u.id, { role: e.target.value })}
                              className="inline-select"
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td>
                            <select
                              value={u.status}
                              onChange={e => updateUser(u.id, { status: e.target.value })}
                              className={`inline-select status-${u.status}`}
                            >
                              <option value="active">Active</option>
                              <option value="suspended">Suspended</option>
                              <option value="pending">Pending</option>
                            </select>
                          </td>
                          <td>{new Date(u.created_at).toLocaleDateString()}</td>
                          <td>-</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pagination">
                  <button className="btn btn-sm" disabled={pagination.page <= 1} onClick={() => loadUsers(pagination.page - 1)}>Previous</button>
                  <span>Page {pagination.page} of {pagination.pages}</span>
                  <button className="btn btn-sm" disabled={pagination.page >= pagination.pages} onClick={() => loadUsers(pagination.page + 1)}>Next</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'transactions' && (
            <div className="card">
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr><th>ID</th><th>User</th><th>Type</th><th>Currency</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                        <td>#{tx.id}</td>
                        <td>{tx.full_name}</td>
                        <td>{tx.tx_type}</td>
                        <td>{tx.currency}</td>
                        <td>{parseFloat(tx.amount).toFixed(6)}</td>
                        <td><span className={`status-badge ${tx.status}`}>{tx.status}</span></td>
                        <td>{new Date(tx.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <button className="btn btn-sm" disabled={pagination.page <= 1} onClick={() => loadTransactions(pagination.page - 1)}>Previous</button>
                <span>Page {pagination.page} of {pagination.pages}</span>
                <button className="btn btn-sm" disabled={pagination.page >= pagination.pages} onClick={() => loadTransactions(pagination.page + 1)}>Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
