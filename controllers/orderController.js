// controllers/orderController.js

const db = require('../config/db');
const { sendSuccess, generateOrderNumber, paginate, paginationMeta } = require('../utils/helpers');

// POST /api/orders  (guest or logged-in)
const createOrder = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      items,                  // [{ product_id, quantity }]
      guest_name, guest_email, guest_phone,
      shipping_address,       // { full_name, phone, address_line, city, province, postal_code }
      payment_method = 'cod',
      coupon_code,
      notes,
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'No items in order' });
    }

    // Validate products + compute totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const [[p]] = await conn.query(
        'SELECT id, name, price, stock_qty FROM products WHERE id = ? AND is_active = 1 FOR UPDATE',
        [item.product_id]);

      if (!p) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `Product ${item.product_id} not found` });
      }
      if (p.stock_qty < item.quantity) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `Insufficient stock for "${p.name}"` });
      }

      const lineTotal = parseFloat(p.price) * item.quantity;
      subtotal += lineTotal;
      orderItems.push({ product_id: p.id, product_name: p.name, unit_price: p.price, quantity: item.quantity, subtotal: lineTotal });
    }

    // Apply coupon
    let discount = 0;
    if (coupon_code) {
      const [[coupon]] = await conn.query(
        `SELECT * FROM coupons
         WHERE code = ? AND is_active = 1
           AND (expires_at IS NULL OR expires_at > NOW())
           AND (max_uses IS NULL OR used_count < max_uses)`, [coupon_code]);

      if (coupon) {
        if (subtotal >= coupon.min_order_amt) {
          discount = coupon.type === 'percent'
            ? Math.round(subtotal * coupon.value / 100 * 100) / 100
            : Math.min(coupon.value, subtotal);
          await conn.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [coupon.id]);
        }
      }
    }

    const shipping_fee = 0;  // extend this with shipping logic as needed
    const total = subtotal - discount + shipping_fee;
    const orderNumber = generateOrderNumber();

    // Insert order
    const [result] = await conn.query(
      `INSERT INTO orders
        (order_number, user_id, guest_name, guest_email, guest_phone,
         shipping_addr, payment_method, subtotal, discount, shipping_fee, total, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        orderNumber,
        req.user?.id || null,
        guest_name   || null,
        guest_email  || null,
        guest_phone  || null,
        shipping_address ? JSON.stringify(shipping_address) : null,
        payment_method,
        subtotal, discount, shipping_fee, total,
        notes || null,
      ]);

    const orderId = result.insertId;

    // Insert items + deduct stock
    for (const oi of orderItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
         VALUES (?,?,?,?,?,?)`,
        [orderId, oi.product_id, oi.product_name, oi.unit_price, oi.quantity, oi.subtotal]);

      await conn.query('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?',
        [oi.quantity, oi.product_id]);
    }

    // Clear server cart if user is logged in
    if (req.user?.id) {
      await conn.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);
    }

    await conn.commit();

    sendSuccess(res, {
      order: { id: orderId, order_number: orderNumber, total, status: 'pending' }
    }, 'Order placed successfully', 201);

  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// GET /api/orders  (admin — all orders)
const getAllOrders = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { status } = req.query;

    let where = [];
    let params = [];
    if (status) { where.push('o.status = ?'); params.push(status); }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM orders o ${whereSQL}`, params);
    const [orders] = await db.query(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       ${whereSQL}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`, [...params, limit, offset]);

    sendSuccess(res, { orders, pagination: paginationMeta(total, page, limit) });
  } catch (err) { next(err); }
};

// GET /api/orders/my  (customer — own orders)
const getMyOrders = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) AS total FROM orders WHERE user_id = ?', [req.user.id]);
    const [orders] = await db.query(
      `SELECT * FROM orders WHERE user_id = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]);
    sendSuccess(res, { orders, pagination: paginationMeta(total, page, limit) });
  } catch (err) { next(err); }
};

// GET /api/orders/:id
const getOrder = async (req, res, next) => {
  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!orders.length) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = orders[0];
    // Customers can only see their own orders
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    sendSuccess(res, { order: { ...order, items } });
  } catch (err) { next(err); }
};

// PUT /api/orders/:id/status  (admin)
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, payment_status } = req.body;
    const fields = []; const values = [];
    if (status)         { fields.push('status = ?');         values.push(status); }
    if (payment_status) { fields.push('payment_status = ?'); values.push(payment_status); }
    if (!fields.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
    await db.query(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, [...values, req.params.id]);
    sendSuccess(res, {}, 'Order status updated');
  } catch (err) { next(err); }
};

module.exports = { createOrder, getAllOrders, getMyOrders, getOrder, updateOrderStatus };
