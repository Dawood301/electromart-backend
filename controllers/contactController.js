// controllers/contactController.js

const db = require('../config/db');
const { sendSuccess, paginate, paginationMeta } = require('../utils/helpers');

// POST /api/contact
const submitMessage = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;
    await db.query(
      'INSERT INTO contact_messages (user_id, name, email, subject, message) VALUES (?,?,?,?,?)',
      [req.user?.id || null, name, email, subject, message]);
    sendSuccess(res, {}, 'Message sent successfully', 201);
  } catch (err) { next(err); }
};

// GET /api/contact  (admin)
const getMessages = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { is_read } = req.query;

    let where = []; let params = [];
    if (is_read !== undefined) { where.push('is_read = ?'); params.push(parseInt(is_read)); }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM contact_messages ${whereSQL}`, params);
    const [messages] = await db.query(
      `SELECT * FROM contact_messages ${whereSQL} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]);

    sendSuccess(res, { messages, pagination: paginationMeta(total, page, limit) });
  } catch (err) { next(err); }
};

// PATCH /api/contact/:id/read  (admin)
const markRead = async (req, res, next) => {
  try {
    await db.query('UPDATE contact_messages SET is_read = 1 WHERE id = ?', [req.params.id]);
    sendSuccess(res, {}, 'Marked as read');
  } catch (err) { next(err); }
};

// DELETE /api/contact/:id  (admin)
const deleteMessage = async (req, res, next) => {
  try {
    await db.query('DELETE FROM contact_messages WHERE id = ?', [req.params.id]);
    sendSuccess(res, {}, 'Message deleted');
  } catch (err) { next(err); }
};

module.exports = { submitMessage, getMessages, markRead, deleteMessage };
