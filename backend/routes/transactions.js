import { Router } from 'express';
import { query, queryOne, insert, run } from '../database.js';
import { isValidCryptoAddress, isPositiveNumber } from '../utils/validators.js';
import { getTransactionStatus, detectTransaction } from '../utils/blockchain.js';

const router = Router();

// GET /api/transactions/detect — polls blockchain for a matching transaction
router.get('/detect', async (req, res) => {
  const { currency, from_address, to_address, transaction_id } = req.query;

  if (!currency || !from_address || !to_address) {
    return res.status(400).json({ error: 'currency, from_address, to_address required' });
  }

  const found = await detectTransaction(currency, from_address, to_address);

  if (found) {
    // Auto-confirm the transaction if we have a transaction_id
    if (transaction_id) {
      const tx = queryOne(
        "SELECT * FROM transactions WHERE id = ? AND user_id = ? AND status = 'authorized'",
        [transaction_id, req.user.user_id]
      );
      if (tx) {
        run(
          "UPDATE transactions SET status = 'confirmed', tx_hash = ?, updated_at = datetime('now') WHERE id = ?",
          [found.hash, transaction_id]
        );
        insert(
          "INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
          [req.user.user_id, 'transaction_auto_detected', `Auto-detected tx #${transaction_id}: ${found.hash}`, req.ip]
        );
      }
    }

    return res.json({ found: true, hash: found.hash, amount: found.amount, confirmations: found.confirmations });
  }

  res.json({ found: false });
});

function logActivity(userId, action, details, ip) {
  insert(
    "INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
    [userId, action, details, ip || 'unknown']
  );
}

// POST /api/transactions/create
router.post('/create', (req, res) => {
  const { wallet_id, recipient_address, amount, note } = req.body;
  const addr = (recipient_address || '').trim();

  const wallet = queryOne(
    "SELECT id, currency, address FROM wallets WHERE id = ? AND user_id = ?",
    [wallet_id, req.user.user_id]
  );
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

  if (!isValidCryptoAddress(wallet.currency, addr)) {
    return res.status(400).json({ error: `Invalid ${wallet.currency} recipient address` });
  }

  if (addr === wallet.address) {
    return res.status(400).json({ error: 'Cannot send to your own address' });
  }

  if (!isPositiveNumber(amount)) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  const txId = insert(
    `INSERT INTO transactions (user_id, wallet_id, tx_type, currency, amount, recipient_address, sender_address, note, status)
     VALUES (?, ?, 'send', ?, ?, ?, ?, ?, 'pending')`,
    [req.user.user_id, wallet_id, wallet.currency, parseFloat(amount), addr, wallet.address, note?.trim() || null]
  );

  logActivity(req.user.user_id, 'transaction_created', `Created ${amount} ${wallet.currency} send transaction #${txId}`, req.ip);

  res.status(201).json({
    message: 'Transaction created. Please authorize to proceed.',
    transaction: {
      id: txId, currency: wallet.currency, amount, recipient_address: addr,
      sender_address: wallet.address, status: 'pending'
    }
  });
});

// POST /api/transactions/authorize
router.post('/authorize', (req, res) => {
  const { transaction_id } = req.body;

  const tx = queryOne(
    "SELECT * FROM transactions WHERE id = ? AND user_id = ? AND status = 'pending'",
    [transaction_id, req.user.user_id]
  );
  if (!tx) return res.status(404).json({ error: 'Pending transaction not found' });

  run(
    "UPDATE transactions SET status = 'authorized', authorized_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
    [transaction_id]
  );

  logActivity(req.user.user_id, 'transaction_authorized', `Authorized transaction #${transaction_id}`, req.ip);

  res.json({
    message: 'Transaction authorized. Please sign and broadcast from your wallet.',
    transaction: {
      id: tx.id, currency: tx.currency, amount: tx.amount,
      recipient_address: tx.recipient_address, sender_address: tx.sender_address, status: 'authorized'
    }
  });
});

// POST /api/transactions/confirm
router.post('/confirm', (req, res) => {
  const { transaction_id, tx_hash } = req.body;

  if (!tx_hash?.trim()) {
    return res.status(400).json({ error: 'Transaction hash is required' });
  }

  const tx = queryOne(
    "SELECT * FROM transactions WHERE id = ? AND user_id = ? AND status = 'authorized'",
    [transaction_id, req.user.user_id]
  );
  if (!tx) return res.status(404).json({ error: 'Authorized transaction not found' });

  run(
    "UPDATE transactions SET status = 'confirmed', tx_hash = ?, updated_at = datetime('now') WHERE id = ?",
    [tx_hash.trim(), transaction_id]
  );

  logActivity(req.user.user_id, 'transaction_confirmed', `Confirmed transaction #${transaction_id} with hash ${tx_hash}`, req.ip);

  res.json({
    message: 'Transaction confirmed and recorded',
    transaction: { id: tx.id, tx_hash: tx_hash.trim(), status: 'confirmed' }
  });
});

// POST /api/transactions/reject
router.post('/reject', (req, res) => {
  const { transaction_id } = req.body;

  const tx = queryOne(
    "SELECT * FROM transactions WHERE id = ? AND user_id = ? AND status IN ('pending', 'authorized')",
    [transaction_id, req.user.user_id]
  );
  if (!tx) return res.status(404).json({ error: 'Transaction not found or already processed' });

  run("UPDATE transactions SET status = 'rejected', updated_at = datetime('now') WHERE id = ?", [transaction_id]);

  logActivity(req.user.user_id, 'transaction_rejected', `Rejected transaction #${transaction_id}`, req.ip);

  res.json({ message: 'Transaction rejected' });
});

// GET /api/transactions/list
router.get('/list', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const currency = (req.query.currency || '').toUpperCase();
  const status = req.query.status || '';

  let where = "WHERE t.user_id = ?";
  const params = [req.user.user_id];

  if (['BTC', 'ETH', 'TRON'].includes(currency)) {
    where += " AND t.currency = ?";
    params.push(currency);
  }

  if (['pending', 'authorized', 'confirmed', 'failed', 'rejected'].includes(status)) {
    where += " AND t.status = ?";
    params.push(status);
  }

  const countResult = queryOne(`SELECT COUNT(*) as total FROM transactions t ${where}`, params);
  const total = countResult.total;

  const transactions = query(
    `SELECT t.*, w.label as wallet_label
     FROM transactions t LEFT JOIN wallets w ON t.wallet_id = w.id
     ${where} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    transactions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

// GET /api/transactions/detail
router.get('/detail', (req, res) => {
  const tx = queryOne(
    `SELECT t.*, w.label as wallet_label FROM transactions t
     LEFT JOIN wallets w ON t.wallet_id = w.id
     WHERE t.id = ? AND t.user_id = ?`,
    [req.query.id, req.user.user_id]
  );
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ transaction: tx });
});

// GET /api/transactions/status
router.get('/status', async (req, res) => {
  const tx = queryOne(
    "SELECT * FROM transactions WHERE id = ? AND user_id = ?",
    [req.query.id, req.user.user_id]
  );
  if (!tx || !tx.tx_hash) {
    return res.status(404).json({ error: 'Transaction not found or no hash recorded' });
  }

  const status = await getTransactionStatus(tx.currency, tx.tx_hash);
  res.json({ blockchain_status: status });
});

export default router;
