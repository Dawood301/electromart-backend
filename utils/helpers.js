// utils/helpers.js

/**
 * Send a consistent success response
 */
const sendSuccess = (res, data = {}, message = 'OK', statusCode = 200) => {
  res.status(statusCode).json({ success: true, message, ...data });
};

/**
 * Generate a human-readable order number: EM-YYYYMMDD-XXXXX
 */
const generateOrderNumber = () => {
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(10000 + Math.random() * 90000);
  return `EM-${date}-${random}`;
};

/**
 * Parse limit / page from query params, return SQL LIMIT + OFFSET
 */
const paginate = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 12));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

/**
 * Build pagination meta for list responses
 */
const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNext:    page < Math.ceil(total / limit),
  hasPrev:    page > 1,
});

module.exports = { sendSuccess, generateOrderNumber, paginate, paginationMeta };
