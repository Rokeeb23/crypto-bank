import { Router } from 'express';
import { query, queryOne, run } from '../database.js';

const router = Router();

// GET /api/admin/users
router.get('/users', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const search = (req.query.search || '').trim();

  let where = '';
  let params = [];

  if (search) {
    where = "WHERE full_name LIKE ? OR email LIKE ?";
    params = [`%${search}%`, `%${search}%`];
  }

  const countResult = queryOne(`SELECT COUNT(*) as total FROM users ${where}`, params);
  const total = countResult.total;

  const users = query(
    `SELECT id, full_name, email, role, status, created_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

// GET /api/admin/user-detail
router.get('/user-detail', (req, res) => {
  const user = queryOne(
    "SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ?",
    [req.query.id]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });

  const wallets = query(
    "SELECT id, currency, address, label, created_at FROM wallets WHERE user_id = ?",
    [req.query.id]
  );

  const txCount = queryOne(
    "SELECT COUNT(*) as total FROM transactions WHERE user_id = ?",
    [req.query.id]
  );

  res.json({ user, wallets, transaction_count: txCount.total });
});

// PUT /api/admin/update-user
router.put('/update-user', (req, res) => {
  const { user_id, status, role } = req.body;

  if (!user_id) return res.status(400).json({ error: 'User ID required' });

  const updates = [];
  const params = [];

  if (status && ['active', 'suspended', 'pending'].includes(status)) {
    updates.push("status = ?");
    params.push(status);
  }

  if (role && ['user', 'admin'].includes(role)) {
    updates.push("role = ?");
    params.push(role);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid updates provided' });
  }

  updates.push("updated_at = datetime('now')");
  params.push(user_id);

  run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  res.json({ message: 'User updated successfully' });
});

// GET /api/admin/all-transactions
router.get('/all-transactions', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const countResult = queryOne("SELECT COUNT(*) as total FROM transactions");
  const total = countResult.total;

  const transactions = query(
    `SELECT t.*, u.full_name, u.email, w.label as wallet_label
     FROM transactions t
     JOIN users u ON t.user_id = u.id
     LEFT JOIN wallets w ON t.wallet_id = w.id
     ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  res.json({
    transactions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const totalUsers = queryOne("SELECT COUNT(*) as c FROM users").c;
  const totalWallets = queryOne("SELECT COUNT(*) as c FROM wallets").c;
  const totalTx = queryOne("SELECT COUNT(*) as c FROM transactions").c;
  const pendingTx = queryOne("SELECT COUNT(*) as c FROM transactions WHERE status = 'pending'").c;

  const recentTx = query(
    `SELECT t.id, t.currency, t.amount, t.status, t.created_at, u.full_name
     FROM transactions t JOIN users u ON t.user_id = u.id
     ORDER BY t.created_at DESC LIMIT 5`
  );

  res.json({
    stats: {
      total_users: totalUsers,
      total_wallets: totalWallets,
      total_transactions: totalTx,
      pending_transactions: pendingTx
    },
    recent_transactions: recentTx
  });
});

export default router;
