// controllers/adminController.js
// Dashboard stats and user management for admins

const db = require('../config/db');
const { sendSuccess, paginate, paginationMeta } = require('../utils/helpers');

// GET /api/admin/stats
const getDashboardStats = async (req, res, next) => {
  try {
    const [[{ total_orders }]]    = await db.query('SELECT COUNT(*) AS total_orders FROM orders');
    const [[{ total_revenue }]]   = await db.query("SELECT COALESCE(SUM(total),0) AS total_revenue FROM orders WHERE payment_status='paid'");
    const [[{ total_products }]]  = await db.query('SELECT COUNT(*) AS total_products FROM products WHERE is_active=1');
    const [[{ total_customers }]] = await db.query("SELECT COUNT(*) AS total_customers FROM users WHERE role='customer'");
    const [[{ unread_messages }]] = await db.query('SELECT COUNT(*) AS unread_messages FROM contact_messages WHERE is_read=0');
    const [[{ pending_orders }]]  = await db.query("SELECT COUNT(*) AS pending_orders FROM orders WHERE status='pending'");
    const [[{ low_stock }]]       = await db.query('SELECT COUNT(*) AS low_stock FROM products WHERE stock_qty <= 5 AND is_active=1');

    // Revenue by month (last 6 months)
    const [monthly] = await db.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
             SUM(total) AS revenue, COUNT(*) AS orders
      FROM   orders
      WHERE  created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP  BY month ORDER BY month ASC`);

    // Top 5 products by order frequency
    const [top_products] = await db.query(`
      SELECT p.name, p.slug, SUM(oi.quantity) AS units_sold,
             SUM(oi.subtotal) AS revenue
      FROM   order_items oi
      JOIN   products p ON p.id = oi.product_id
      GROUP  BY oi.product_id
      ORDER  BY units_sold DESC LIMIT 5`);

    sendSuccess(res, {
      stats: {
        total_orders, total_revenue, total_products, total_customers,
        unread_messages, pending_orders, low_stock,
      },
      monthly_revenue: monthly,
      top_products,
    });
  } catch (err) { next(err); }
};

// GET /api/admin/users
const getUsers = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { role, search } = req.query;

    let where = []; let params = [];
    if (role)   { where.push('role = ?');                  params.push(role); }
    if (search) { where.push('(name LIKE ? OR email LIKE ?)'); const l=`%${search}%`; params.push(l,l); }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM users ${whereSQL}`, params);
    const [users] = await db.query(
      `SELECT id, name, email, phone, role, is_active, created_at
       FROM users ${whereSQL} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]);

    sendSuccess(res, { users, pagination: paginationMeta(total, page, limit) });
  } catch (err) { next(err); }
};

// PATCH /api/admin/users/:id/toggle
const toggleUserStatus = async (req, res, next) => {
  try {
    await db.query('UPDATE users SET is_active = NOT is_active WHERE id = ?', [req.params.id]);
    sendSuccess(res, {}, 'User status toggled');
  } catch (err) { next(err); }
};

// GET /api/admin/brands
const getBrands = async (req, res, next) => {
  try {
    const [brands] = await db.query('SELECT * FROM brands WHERE is_active = 1 ORDER BY name');
    sendSuccess(res, { brands });
  } catch (err) { next(err); }
};

// POST /api/admin/brands
const createBrand = async (req, res, next) => {
  try {
    const slugify = require('slugify');
    const { name, logo_url } = req.body;
    const slug = slugify(name, { lower: true, strict: true });
    const [r] = await db.query('INSERT INTO brands (name, slug, logo_url) VALUES (?,?,?)',
      [name, slug, logo_url || null]);
    const [[brand]] = await db.query('SELECT * FROM brands WHERE id = ?', [r.insertId]);
    sendSuccess(res, { brand }, 'Brand created', 201);
  } catch (err) { next(err); }
};

// GET /api/admin/coupons
const getCoupons = async (req, res, next) => {
  try {
    const [coupons] = await db.query('SELECT * FROM coupons ORDER BY created_at DESC');
    sendSuccess(res, { coupons });
  } catch (err) { next(err); }
};

// POST /api/admin/coupons
const createCoupon = async (req, res, next) => {
  try {
    const { code, type, value, min_order_amt, max_uses, expires_at } = req.body;
    await db.query(
      'INSERT INTO coupons (code, type, value, min_order_amt, max_uses, expires_at) VALUES (?,?,?,?,?,?)',
      [code.toUpperCase(), type, value, min_order_amt || 0, max_uses || null, expires_at || null]);
    sendSuccess(res, {}, 'Coupon created', 201);
  } catch (err) { next(err); }
};

// DELETE /api/admin/coupons/:id
const deleteCoupon = async (req, res, next) => {
  try {
    await db.query('UPDATE coupons SET is_active = 0 WHERE id = ?', [req.params.id]);
    sendSuccess(res, {}, 'Coupon deactivated');
  } catch (err) { next(err); }
};

module.exports = {
  getDashboardStats, getUsers, toggleUserStatus,
  getBrands, createBrand,
  getCoupons, createCoupon, deleteCoupon,
};
