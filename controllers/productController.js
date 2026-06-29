// controllers/productController.js

const db      = require('../config/db');
const slugify = require('slugify');
const { sendSuccess, paginate, paginationMeta } = require('../utils/helpers');

// ─── helpers ────────────────────────────────────────────────────
const makeSlug = (name) => slugify(name, { lower: true, strict: true });

// Full product detail query (joins images + features + specs)
const fetchProductById = async (id) => {
  const [products] = await db.query(`
    SELECT p.*,
           c.name AS category_name, c.slug AS category_slug,
           b.name AS brand_name,
           pi.image_url AS primary_image
    FROM   products p
    LEFT JOIN categories    c  ON c.id = p.category_id
    LEFT JOIN brands        b  ON b.id = p.brand_id
    LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
    WHERE  p.id = ? LIMIT 1`, [id]);

  if (!products.length) return null;
  const product = products[0];

  const [images]   = await db.query(
    'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order', [id]);
  const [features] = await db.query(
    'SELECT feature FROM product_features WHERE product_id = ? ORDER BY sort_order', [id]);
  const [specs]    = await db.query(
    'SELECT spec_key, spec_value FROM product_specs WHERE product_id = ? ORDER BY sort_order', [id]);

  return { ...product, images, features: features.map(f => f.feature), specs };
};

// ─── PUBLIC ROUTES ───────────────────────────────────────────────

// GET /api/products
const getProducts = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { category, brand, featured, search, sort, min_price, max_price } = req.query;

    let where  = ['p.is_active = 1'];
    let params = [];

    if (category)  { where.push('c.slug = ?');        params.push(category); }
    if (brand)     { where.push('b.slug = ?');         params.push(brand); }
    if (featured)  { where.push('p.is_featured = 1'); }
    if (min_price) { where.push('p.price >= ?');       params.push(parseFloat(min_price)); }
    if (max_price) { where.push('p.price <= ?');       params.push(parseFloat(max_price)); }
    if (search)    {
      where.push('(p.name LIKE ? OR p.short_desc LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like);
    }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Sort
    const sortMap = {
      'price_asc':  'p.price ASC',
      'price_desc': 'p.price DESC',
      'newest':     'p.created_at DESC',
      'name':       'p.name ASC',
    };
    const orderSQL = `ORDER BY ${sortMap[sort] || 'p.sort_order ASC, p.id ASC'}`;

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands     b ON b.id = p.brand_id
       ${whereSQL}`, params);

    const [rows] = await db.query(
      `SELECT p.id, p.name, p.slug, p.short_desc, p.price, p.old_price,
              p.stock_qty, p.badge, p.is_featured, p.sort_order,
              c.name AS category_name, c.slug AS category_slug,
              b.name AS brand_name,
              pi.image_url AS primary_image
       FROM   products p
       LEFT JOIN categories    c  ON c.id = p.category_id
       LEFT JOIN brands        b  ON b.id = p.brand_id
       LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
       ${whereSQL} ${orderSQL}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]);

    sendSuccess(res, { products: rows, pagination: paginationMeta(total, page, limit) });
  } catch (err) { next(err); }
};

// GET /api/products/:slug
const getProduct = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id FROM products WHERE slug = ? AND is_active = 1', [req.params.slug]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Product not found' });
    const product = await fetchProductById(rows[0].id);
    sendSuccess(res, { product });
  } catch (err) { next(err); }
};

// GET /api/products/featured — for the hero coverflow
const getFeatured = async (req, res, next) => {
  try {
    const [products] = await db.query(`
      SELECT p.id, p.name, p.slug, p.short_desc, p.price, p.old_price, p.badge,
             c.name AS category_name,
             pi.image_url AS primary_image
      FROM   products p
      LEFT JOIN categories    c  ON c.id = p.category_id
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
      WHERE  p.is_featured = 1 AND p.is_active = 1
      ORDER BY p.sort_order ASC
      LIMIT 12`);
    sendSuccess(res, { products });
  } catch (err) { next(err); }
};

// ─── ADMIN ROUTES ────────────────────────────────────────────────

// POST /api/products  (admin)
const createProduct = async (req, res, next) => {
  try {
    const {
      category_id, brand_id, name, short_desc, description,
      price, old_price, stock_qty, sku, badge, is_featured, sort_order,
      features = [], specs = [], images = [],
    } = req.body;

    const slug = makeSlug(name);

    const [result] = await db.query(
      `INSERT INTO products
        (category_id, brand_id, name, slug, short_desc, description,
         price, old_price, stock_qty, sku, badge, is_featured, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [category_id, brand_id || null, name, slug, short_desc || null,
       description || null, price, old_price || null, stock_qty || 0,
       sku || null, badge || null, is_featured ? 1 : 0, sort_order || 0]
    );

    const productId = result.insertId;

    // Insert features
    for (let i = 0; i < features.length; i++) {
      await db.query(
        'INSERT INTO product_features (product_id, feature, sort_order) VALUES (?,?,?)',
        [productId, features[i], i + 1]);
    }

    // Insert specs
    for (let i = 0; i < specs.length; i++) {
      await db.query(
        'INSERT INTO product_specs (product_id, spec_key, spec_value, sort_order) VALUES (?,?,?,?)',
        [productId, specs[i].key, specs[i].value, i + 1]);
    }

    // Insert images (URLs or paths from upload)
    for (let i = 0; i < images.length; i++) {
      await db.query(
        'INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) VALUES (?,?,?,?,?)',
        [productId, images[i].url, images[i].alt || name, i === 0 ? 1 : 0, i + 1]);
    }

    const product = await fetchProductById(productId);
    sendSuccess(res, { product }, 'Product created', 201);
  } catch (err) { next(err); }
};

// PUT /api/products/:id  (admin)
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      category_id, brand_id, name, short_desc, description,
      price, old_price, stock_qty, sku, badge,
      is_featured, is_active, sort_order,
      features, specs,
    } = req.body;

    const slug = name ? makeSlug(name) : undefined;

    const fields = [];
    const values = [];
    const map = { category_id, brand_id, name, slug, short_desc, description,
                  price, old_price, stock_qty, sku, badge,
                  is_featured, is_active, sort_order };

    for (const [k, v] of Object.entries(map)) {
      if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); }
    }

    if (fields.length) {
      await db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
    }

    // Replace features if provided
    if (Array.isArray(features)) {
      await db.query('DELETE FROM product_features WHERE product_id = ?', [id]);
      for (let i = 0; i < features.length; i++) {
        await db.query(
          'INSERT INTO product_features (product_id, feature, sort_order) VALUES (?,?,?)',
          [id, features[i], i + 1]);
      }
    }

    // Replace specs if provided
    if (Array.isArray(specs)) {
      await db.query('DELETE FROM product_specs WHERE product_id = ?', [id]);
      for (let i = 0; i < specs.length; i++) {
        await db.query(
          'INSERT INTO product_specs (product_id, spec_key, spec_value, sort_order) VALUES (?,?,?,?)',
          [id, specs[i].key, specs[i].value, i + 1]);
      }
    }

    const product = await fetchProductById(id);
    sendSuccess(res, { product }, 'Product updated');
  } catch (err) { next(err); }
};

// DELETE /api/products/:id  (admin — soft delete)
const deleteProduct = async (req, res, next) => {
  try {
    await db.query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
    sendSuccess(res, {}, 'Product deactivated');
  } catch (err) { next(err); }
};

// POST /api/products/:id/images  (admin — upload image)
const uploadProductImage = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const { id } = req.params;
    const { is_primary, alt_text } = req.body;
    const imageUrl = `/uploads/${req.file.filename}`;

    if (is_primary === '1' || is_primary === true) {
      await db.query('UPDATE product_images SET is_primary = 0 WHERE product_id = ?', [id]);
    }

    await db.query(
      'INSERT INTO product_images (product_id, image_url, alt_text, is_primary) VALUES (?,?,?,?)',
      [id, imageUrl, alt_text || null, is_primary ? 1 : 0]);

    sendSuccess(res, { image_url: imageUrl }, 'Image uploaded', 201);
  } catch (err) { next(err); }
};

// DELETE /api/products/:id/images/:imageId  (admin)
const deleteProductImage = async (req, res, next) => {
  try {
    await db.query('DELETE FROM product_images WHERE id = ? AND product_id = ?',
      [req.params.imageId, req.params.id]);
    sendSuccess(res, {}, 'Image removed');
  } catch (err) { next(err); }
};

module.exports = {
  getProducts, getProduct, getFeatured,
  createProduct, updateProduct, deleteProduct,
  uploadProductImage, deleteProductImage,
};
