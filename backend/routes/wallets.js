import { Router } from 'express';
import { query, queryOne, insert, run } from '../database.js';
import { isValidCryptoAddress } from '../utils/validators.js';
import { getBalance, getPrices, verifyAddress } from '../utils/blockchain.js';

const router = Router();

// GET /api/wallets/list
router.get('/list', (req, res) => {
  const wallets = query(
    "SELECT id, currency, address, label, is_primary, created_at FROM wallets WHERE user_id = ? ORDER BY currency, created_at",
    [req.user.user_id]
  );
  res.json({ wallets });
});

// POST /api/wallets/add — verifies address on the real blockchain before accepting
router.post('/add', async (req, res) => {
  const { currency, address, label } = req.body;
  const cur = (currency || '').toUpperCase().trim();
  const addr = (address || '').trim();

  if (!['BTC', 'ETH', 'TRON'].includes(cur)) {
    return res.status(400).json({ error: 'Supported currencies: BTC, ETH, TRON' });
  }

  if (!isValidCryptoAddress(cur, addr)) {
    return res.status(400).json({ error: `Invalid ${cur} address format` });
  }

  // Verify the address actually exists on the blockchain
  const verification = await verifyAddress(cur, addr);
  if (!verification.valid) {
    return res.status(400).json({ error: verification.error });
  }

  const existing = queryOne(
    "SELECT id FROM wallets WHERE user_id = ? AND currency = ? AND address = ?",
    [req.user.user_id, cur, addr]
  );
  if (existing) {
    return res.status(409).json({ error: 'Wallet already linked' });
  }

  const countResult = queryOne(
    "SELECT COUNT(*) as count FROM wallets WHERE user_id = ? AND currency = ?",
    [req.user.user_id, cur]
  );
  const isPrimary = countResult.count === 0 ? 1 : 0;

  const walletId = insert(
    "INSERT INTO wallets (user_id, currency, address, label, is_primary) VALUES (?, ?, ?, ?, ?)",
    [req.user.user_id, cur, addr, label?.trim() || null, isPrimary]
  );

  res.status(201).json({
    message: 'Wallet linked successfully',
    wallet: {
      id: walletId, currency: cur, address: addr,
      label: label?.trim() || null, is_primary: isPrimary,
      verified_balance: verification.balance
    }
  });
});

// DELETE /api/wallets/remove
router.delete('/remove', (req, res) => {
  const walletId = req.query.id;
  if (!walletId) return res.status(400).json({ error: 'Wallet ID required' });

  const wallet = queryOne("SELECT id FROM wallets WHERE id = ? AND user_id = ?", [walletId, req.user.user_id]);
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

  run("DELETE FROM wallets WHERE id = ? AND user_id = ?", [walletId, req.user.user_id]);
  res.json({ message: 'Wallet removed' });
});

// GET /api/wallets/balances
router.get('/balances', async (req, res) => {
  const wallets = query(
    "SELECT id, currency, address, label FROM wallets WHERE user_id = ?",
    [req.user.user_id]
  );

  const balances = await Promise.all(
    wallets.map(async (wallet) => {
      const balanceData = await getBalance(wallet.currency, wallet.address);
      return { ...wallet, balance_data: balanceData };
    })
  );

  res.json({ balances });
});

// GET /api/wallets/prices
router.get('/prices', async (req, res) => {
  const prices = await getPrices();
  res.json({ prices });
});

export default router;
