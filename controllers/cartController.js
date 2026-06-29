// controllers/cartController.js

const db = require('../config/db');
const { sendSuccess } = require('../utils/helpers');

const getCartWithDetails = async (userId) => {
  const [items] = await db.query(`
    SELECT ci.id, ci.quantity,
           p.id AS product_id, p.name, p.slug, p.price, p.old_price, p.stock_qty,
           pi.image_url AS image
    FROM   cart_items ci
    JOIN   products      p  ON p.id = ci.product_id AND p.is_active = 1
    LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
    WHERE  ci.user_id = ?
    ORDER  BY ci.added_at DESC`, [userId]);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return { items, subtotal, item_count: items.reduce((s, i) => s + i.quantity, 0) };
};

// GET /api/cart
const getCart = async (req, res, next) => {
  try {
    const cart = await getCartWithDetails(req.user.id);
    sendSuccess(res, { cart });
  } catch (err) { next(err); }
};

// POST /api/cart  { product_id, quantity }
const addToCart = async (req, res, next) => {
  try {
    const { product_id, quantity = 1 } = req.body;

    // Check product exists and has stock
    const [products] = await db.query(
      'SELECT id, stock_qty FROM products WHERE id = ? AND is_active = 1', [product_id]);
    if (!products.length) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (products[0].stock_qty < quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient stock' });
    }

    await db.query(`
      INSERT INTO cart_items (user_id, product_id, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
      [req.user.id, product_id, quantity, quantity]);

    const cart = await getCartWithDetails(req.user.id);
    sendSuccess(res, { cart }, 'Added to cart');
  } catch (err) { next(err); }
};

// PUT /api/cart/:cartItemId  { quantity }
const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (quantity < 1) {
      await db.query('DELETE FROM cart_items WHERE id = ? AND user_id = ?',
        [req.params.cartItemId, req.user.id]);
    } else {
      await db.query('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
        [quantity, req.params.cartItemId, req.user.id]);
    }
    const cart = await getCartWithDetails(req.user.id);
    sendSuccess(res, { cart }, 'Cart updated');
  } catch (err) { next(err); }
};

// DELETE /api/cart/:cartItemId
const removeFromCart = async (req, res, next) => {
  try {
    await db.query('DELETE FROM cart_items WHERE id = ? AND user_id = ?',
      [req.params.cartItemId, req.user.id]);
    const cart = await getCartWithDetails(req.user.id);
    sendSuccess(res, { cart }, 'Item removed');
  } catch (err) { next(err); }
};

// DELETE /api/cart
const clearCart = async (req, res, next) => {
  try {
    await db.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);
    sendSuccess(res, { cart: { items: [], subtotal: 0, item_count: 0 } }, 'Cart cleared');
  } catch (err) { next(err); }
};

module.exports = { getCart, addToCart, updateCartItem, removeFromCart, clearCart };
