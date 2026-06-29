// controllers/categoryController.js

const db      = require('../config/db');
const slugify = require('slugify');
const { sendSuccess } = require('../utils/helpers');

const makeSlug = (name) => slugify(name, { lower: true, strict: true });

// GET /api/categories
const getCategories = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*,
             COUNT(p.id) AS product_count
      FROM   categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
      WHERE  c.is_active = 1
      GROUP  BY c.id
      ORDER  BY c.sort_order ASC, c.name ASC`);
    sendSuccess(res, { categories: rows });
  } catch (err) { next(err); }
};

// GET /api/categories/:slug
const getCategory = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM categories WHERE slug = ? AND is_active = 1', [req.params.slug]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Category not found' });
    sendSuccess(res, { category: rows[0] });
  } catch (err) { next(err); }
};

// POST /api/categories  (admin)
const createCategory = async (req, res, next) => {
  try {
    const { name, description, parent_id, image_url, sort_order } = req.body;
    const slug = makeSlug(name);
    const [result] = await db.query(
      'INSERT INTO categories (name, slug, description, parent_id, image_url, sort_order) VALUES (?,?,?,?,?,?)',
      [name, slug, description || null, parent_id || null, image_url || null, sort_order || 0]);
    const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [result.insertId]);
    sendSuccess(res, { category: rows[0] }, 'Category created', 201);
  } catch (err) { next(err); }
};

// PUT /api/categories/:id  (admin)
const updateCategory = async (req, res, next) => {
  try {
    const { name, description, parent_id, image_url, sort_order, is_active } = req.body;
    const slug = name ? makeSlug(name) : undefined;

    const fields = []; const values = [];
    const map = { name, slug, description, parent_id, image_url, sort_order, is_active };
    for (const [k, v] of Object.entries(map)) {
      if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); }
    }
    if (fields.length) {
      await db.query(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, [...values, req.params.id]);
    }
    const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    sendSuccess(res, { category: rows[0] }, 'Category updated');
  } catch (err) { next(err); }
};

// DELETE /api/categories/:id  (admin — soft delete)
const deleteCategory = async (req, res, next) => {
  try {
    await db.query('UPDATE categories SET is_active = 0 WHERE id = ?', [req.params.id]);
    sendSuccess(res, {}, 'Category deactivated');
  } catch (err) { next(err); }
};

module.exports = { getCategories, getCategory, createCategory, updateCategory, deleteCategory };
