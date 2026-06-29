import { Router } from 'express';
import { query, queryOne, insert, run } from '../database.js';

const router = Router();

// POST /api/send/with-key — custodial send using private key
// The key is used once to sign, never stored
router.post('/with-key', async (req, res) => {
  const { currency, private_key, to_address, amount, wallet_id } = req.body;

  if (!private_key || !to_address || !amount || !currency) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    let txHash, fromAddress;

    if (currency === 'TRON') {
      const result = await sendTRONWithKey(private_key, to_address, amount);
      txHash = result.hash;
      fromAddress = result.from;
    } else if (currency === 'BTC') {
      return res.status(400).json({ error: 'BTC key-based sending requires a specialized signing flow. Use a wallet extension or Payment QR instead.' });
    } else if (currency === 'ETH') {
      const result = await sendETHWithKey(private_key, to_address, amount);
      txHash = result.hash;
      fromAddress = result.from;
    } else {
      return res.status(400).json({ error: 'Unsupported currency' });
    }

    // Record the transaction
    const txId = insert(
      `INSERT INTO transactions (user_id, wallet_id, tx_type, currency, amount, recipient_address, sender_address, tx_hash, status, authorized_at)
       VALUES (?, ?, 'send', ?, ?, ?, ?, ?, 'confirmed', datetime('now'))`,
      [req.user.user_id, wallet_id || 0, currency, parseFloat(amount), to_address, fromAddress, txHash]
    );

    // Log activity
    insert(
      "INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
      [req.user.user_id, 'key_send', `Sent ${amount} ${currency} to ${to_address} (tx: ${txHash})`, req.ip]
    );

    res.json({
      message: 'Transaction sent successfully',
      transaction: { id: txId, hash: txHash, from: fromAddress, to: to_address, amount, currency, status: 'confirmed' }
    });

  } catch (err) {
    res.status(400).json({ error: err.message || 'Transaction failed' });
  }
});

async function sendTRONWithKey(privateKey, toAddress, amount) {
  const TronWeb = (await import('tronweb')).default;
  const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io', privateKey: privateKey.replace(/^0x/, '') });
  const sun = Math.floor(parseFloat(amount) * 1000000);
  const tx = await tronWeb.trx.sendTransaction(toAddress, sun);
  if (!tx.result) throw new Error('TRON transaction failed: ' + JSON.stringify(tx));
  return { hash: tx.txid || tx.transaction?.txID, from: tronWeb.defaultAddress.base58 };
}

async function sendETHWithKey(privateKey, toAddress, amount) {
  const { Wallet, JsonRpcProvider, parseEther } = await import('ethers');
  const provider = new JsonRpcProvider('https://eth.llamarpc.com');
  const wallet = new Wallet(privateKey, provider);
  const tx = await wallet.sendTransaction({ to: toAddress, value: parseEther(amount.toString()) });
  const receipt = await tx.wait();
  return { hash: receipt.hash, from: wallet.address };
}

export default router;
