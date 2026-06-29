import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, authenticate } from '../middleware/auth.js';
import { query, queryOne, insert, run } from '../database.js';
import { isValidEmail } from '../utils/validators.js';

const router = Router();

// POST /api/auth/register  (public)
router.post('/register', (req, res) => {
  const { full_name, email, password } = req.body;

  if (!full_name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = queryOne("SELECT id FROM users WHERE email = ?", [email.trim()]);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const userId = insert(
    "INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)",
    [full_name.trim(), email.trim(), passwordHash]
  );

  const token = generateToken({ user_id: userId, email: email.trim(), role: 'user' });

  res.status(201).json({
    message: 'Registration successful',
    token,
    user: { id: userId, full_name: full_name.trim(), email: email.trim(), role: 'user' }
  });
});

// POST /api/auth/login  (public)
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = queryOne(
    "SELECT id, full_name, email, password_hash, role, status FROM users WHERE email = ?",
    [email.trim()]
  );

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'Account has been suspended' });
  }

  const token = generateToken({ user_id: user.id, email: user.email, role: user.role });

  res.json({
    message: 'Login successful',
    token,
    user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role }
  });
});

// GET /api/auth/profile  (protected)
router.get('/profile', authenticate, (req, res) => {
  const user = queryOne(
    "SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ?",
    [req.user.user_id]
  );

  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// PUT /api/auth/profile  (protected)
router.put('/profile', authenticate, (req, res) => {
  const { full_name } = req.body;

  if (!full_name?.trim()) {
    return res.status(400).json({ error: 'Full name is required' });
  }

  run("UPDATE users SET full_name = ?, updated_at = datetime('now') WHERE id = ?",
    [full_name.trim(), req.user.user_id]);

  res.json({ message: 'Profile updated successfully' });
});

export default router;
