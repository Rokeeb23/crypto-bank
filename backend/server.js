import express from 'express';
import cors from 'cors';
import { initDatabase } from './database.js';
import { authenticate, requireAdmin } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import walletRoutes from './routes/wallets.js';
import transactionRoutes from './routes/transactions.js';
import adminRoutes from './routes/admin.js';
import sendRoutes from './routes/send.js';

const app = express();
const PORT = 5000;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);

app.use('/api/wallets', authenticate, walletRoutes);
app.use('/api/transactions', authenticate, transactionRoutes);
app.use('/api/send', authenticate, sendRoutes);
app.use('/api/admin', requireAdmin, adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CryptoBank API is running' });
});

async function start() {
  await initDatabase();

  app.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('  CryptoBank API Server');
    console.log(`  Running on: http://localhost:${PORT}`);
    console.log('  Database:   SQLite (cryptobank.db)');
    console.log('========================================');
    console.log('');
    console.log('Default admin login:');
    console.log('  Email:    admin@cryptobank.com');
    console.log('  Password: password');
    console.log('');
  });
}

start().catch(console.error);
