// controllers/authController.js

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');
const { sendSuccess } = require('../utils/helpers');

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash, phone) VALUES (?, ?, ?, ?)',
      [name, email, hash, phone || null]
    );

    const user = { id: result.insertId, email, role: 'customer' };
    sendSuccess(res, { token: signToken(user), user: { id: user.id, name, email, role: 'customer' } },
      'Registration successful', 201);
  } catch (err) { next(err); }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const [rows] = await db.query(
      'SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = ?',
      [email]
    );
    const user = rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const { password_hash, is_active, ...safe } = user;
    sendSuccess(res, { token: signToken(user), user: safe }, 'Login successful');
  } catch (err) { next(err); }
};

// GET /api/auth/me  (protected)
const getMe = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    sendSuccess(res, { user: rows[0] });
  } catch (err) { next(err); }
};

// PUT /api/auth/me  (protected)
const updateMe = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    await db.query('UPDATE users SET name = ?, phone = ? WHERE id = ?',
      [name, phone || null, req.user.id]);
    sendSuccess(res, {}, 'Profile updated');
  } catch (err) { next(err); }
};

// PUT /api/auth/change-password  (protected)
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const match  = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) return res.status(400).json({ success: false, message: 'Current password incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    sendSuccess(res, {}, 'Password changed successfully');
  } catch (err) { next(err); }
};

module.exports = { register, login, getMe, updateMe, changePassword };
