-- ============================================================
--  ElectroMart — MySQL Schema
--  Run this once against your `electromart` database.
--  Designed for extensibility: every core entity is loosely
--  coupled so features (variants, coupons, reviews, shipping
--  zones, etc.) can be added without altering existing tables.
-- ============================================================

CREATE DATABASE IF NOT EXISTS electromart
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE electromart;

-- ─────────────────────────────────────────
--  1. CATEGORIES
--  Hierarchical (parent_id supports sub-categories in future)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  parent_id   INT UNSIGNED DEFAULT NULL,
  image_url   VARCHAR(500),
  sort_order  SMALLINT UNSIGNED DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────
--  2. PRODUCTS
--  Core product table — extensible via product_meta
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id   INT UNSIGNED NOT NULL,
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(280) NOT NULL UNIQUE,
  description   TEXT,
  price         DECIMAL(12,2) NOT NULL,
  old_price     DECIMAL(12,2) DEFAULT NULL,
  stock         INT UNSIGNED NOT NULL DEFAULT 0,
  sku           VARCHAR(100) UNIQUE,
  badge         VARCHAR(60) DEFAULT NULL,   -- 'Best Seller', 'New', 'Sale', etc.
  is_featured   TINYINT(1) NOT NULL DEFAULT 0,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

-- ─────────────────────────────────────────
--  3. PRODUCT IMAGES
--  Multiple images per product; sort_order = 0 is primary
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_images (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  url         VARCHAR(500) NOT NULL,
  alt_text    VARCHAR(255),
  sort_order  SMALLINT UNSIGNED DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
--  4. PRODUCT FEATURES  (bullet points in quick-view)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_features (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  feature     VARCHAR(500) NOT NULL,
  sort_order  SMALLINT UNSIGNED DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
--  5. PRODUCT META  (arbitrary key-value — brand, warranty, etc.)
--  Keeps the core table clean while allowing infinite attributes
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_meta (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  meta_key    VARCHAR(100) NOT NULL,
  meta_value  TEXT,
  UNIQUE KEY uq_product_meta (product_id, meta_key),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
--  6. USERS  (customers + admins)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(20),
  role          ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
--  7. ADDRESSES  (shipping/billing — multiple per user)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addresses (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  label       VARCHAR(50) DEFAULT 'Home',   -- 'Home', 'Office', etc.
  street      VARCHAR(300) NOT NULL,
  city        VARCHAR(100) NOT NULL,
  state       VARCHAR(100) NOT NULL,
  zip         VARCHAR(20),
  country     VARCHAR(80) NOT NULL DEFAULT 'Pakistan',
  is_default  TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
--  8. ORDERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number     VARCHAR(30) NOT NULL UNIQUE,   -- e.g. EM-2026-00001
  user_id          INT UNSIGNED DEFAULT NULL,      -- NULL = guest checkout
  guest_name       VARCHAR(150),
  guest_email      VARCHAR(254),
  guest_phone      VARCHAR(20),
  shipping_address TEXT NOT NULL,                  -- JSON snapshot at time of order
  subtotal         DECIMAL(12,2) NOT NULL,
  discount         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  delivery_fee     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total            DECIMAL(12,2) NOT NULL,
  payment_method   ENUM('cod','bank_transfer','card','easypaisa','jazzcash')
                     NOT NULL DEFAULT 'cod',
  payment_status   ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  status           ENUM('pending','confirmed','processing','shipped','delivered','cancelled')
                     NOT NULL DEFAULT 'pending',
  notes            TEXT,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────
--  9. ORDER ITEMS  (price snapshot — never reference live product price)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED NOT NULL,
  product_id  INT UNSIGNED NOT NULL,
  product_name VARCHAR(255) NOT NULL,   -- snapshot
  unit_price  DECIMAL(12,2) NOT NULL,   -- snapshot
  quantity    SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  subtotal    DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- ─────────────────────────────────────────
-- 10. CONTACT MESSAGES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  email       VARCHAR(254) NOT NULL,
  subject     VARCHAR(255),
  message     TEXT NOT NULL,
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- 11. REVIEWS  (future — schema ready)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED DEFAULT NULL,
  guest_name  VARCHAR(100),
  rating      TINYINT UNSIGNED NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       VARCHAR(200),
  body        TEXT,
  is_approved TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE SET NULL
);

-- ─────────────────────────────────────────
-- 12. REFRESH TOKENS  (JWT rotation)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- SEED: Categories
-- ─────────────────────────────────────────
INSERT IGNORE INTO categories (name, slug, description, sort_order) VALUES
  ('Cooling',       'cooling',       'Refrigerators, air conditioners, deep freezers', 1),
  ('Laundry',       'laundry',       'Washing machines, dryers, irons',               2),
  ('Entertainment', 'entertainment', 'Smart TVs, projectors, home theatre',           3),
  ('Kitchen',       'kitchen',       'Microwaves, blenders, toasters, ovens',         4),
  ('Cleaning',      'cleaning',      'Vacuum cleaners, steam mops',                   5);

-- ─────────────────────────────────────────
-- SEED: Products  (mirrors your existing frontend data)
-- ─────────────────────────────────────────
INSERT IGNORE INTO products
  (category_id, name, slug, description, price, old_price, stock, sku, badge, is_featured)
VALUES
  (1, 'Smart Refrigerator',       'smart-refrigerator',
   'Energy-efficient refrigerator with advanced inverter technology, frost-free operation, and smart temperature sensors for optimal food preservation.',
   85000, 99000, 20, 'EM-REF-001', 'Best Seller', 1),

  (2, 'Automatic Washing Machine','automatic-washing-machine',
   'Premium front-load washing machine with 8kg capacity, 15 pre-set wash programs, and a digital display for precise control.',
   65000, 74000, 15, 'EM-WSH-001', NULL, 1),

  (3, 'LED Smart TV 55"',         'led-smart-tv-55',
   'Immersive 55-inch 4K UHD Android Smart TV with built-in Wi-Fi, Dolby Audio, and access to all major streaming platforms.',
   120000, 140000, 10, 'EM-TV-001', 'Hot Deal', 1),

  (1, 'Inverter Air Conditioner', 'inverter-air-conditioner',
   '1.5 ton DC inverter air conditioner with 5-star energy rating, powerful cooling, and whisper-quiet operation.',
   95000, 110000, 12, 'EM-AC-001', NULL, 1),

  (4, 'Microwave Oven',           'microwave-oven',
   '30-litre convection microwave oven with grill function, 10 power levels, and 40 auto-cook recipes.',
   22000, 28000, 30, 'EM-MW-001', 'Sale', 0),

  (5, 'Vacuum Cleaner',           'vacuum-cleaner',
   'Powerful 2200W bagless vacuum cleaner with HEPA filtration, 2L dust container, and multiple attachments.',
   18000, 23000, 25, 'EM-VC-001', NULL, 0),

  (4, 'Kitchen Appliances Bundle','kitchen-appliances-bundle',
   'Complete kitchen starter bundle including a blender, pop-up toaster, electric kettle, and food processor.',
   35000, 48000, 8, 'EM-KB-001', 'Bundle', 0),

  (1, 'Deep Freezer 14 Cu.Ft',   'deep-freezer-14-cuft',
   'Large-capacity 14 cubic foot chest freezer with fast-freeze function, secure lockable lid, and low-energy operation.',
   55000, 63000, 10, 'EM-DF-001', NULL, 0);

-- ─────────────────────────────────────────
-- SEED: Product Features
-- ─────────────────────────────────────────
SET @ref = (SELECT id FROM products WHERE sku='EM-REF-001');
SET @wsh = (SELECT id FROM products WHERE sku='EM-WSH-001');
SET @tv  = (SELECT id FROM products WHERE sku='EM-TV-001');
SET @ac  = (SELECT id FROM products WHERE sku='EM-AC-001');
SET @mw  = (SELECT id FROM products WHERE sku='EM-MW-001');
SET @vc  = (SELECT id FROM products WHERE sku='EM-VC-001');
SET @kb  = (SELECT id FROM products WHERE sku='EM-KB-001');
SET @df  = (SELECT id FROM products WHERE sku='EM-DF-001');

INSERT IGNORE INTO product_features (product_id, feature, sort_order) VALUES
  (@ref, 'Inverter compressor – saves up to 40% energy', 1),
  (@ref, 'Twin cooling system (fridge + freezer separate)', 2),
  (@ref, 'Frost-free with auto defrost', 3),
  (@ref, 'Smart sensor for humidity control', 4),
  (@ref, '5-year compressor warranty', 5),

  (@wsh, '8 kg capacity, suitable for large families', 1),
  (@wsh, '15 wash programs including delicate & quick wash', 2),
  (@wsh, '1200 RPM spin speed', 3),
  (@wsh, 'Child safety lock', 4),
  (@wsh, 'Energy Star rated – 5 star', 5),

  (@tv,  '55" 4K UHD display (3840×2160)', 1),
  (@tv,  'Android 11 OS with Google Play Store', 2),
  (@tv,  'Dolby Vision & Dolby Atmos Audio', 3),
  (@tv,  'Built-in Wi-Fi & Bluetooth 5.0', 4),
  (@tv,  '3x HDMI, 2x USB ports', 5),

  (@ac,  '1.5 ton capacity – ideal for medium rooms', 1),
  (@ac,  'DC Inverter – 50% energy savings', 2),
  (@ac,  '5-star energy rating', 3),
  (@ac,  'WiFi control via smartphone app', 4),
  (@ac,  'Auto-clean function, 10-year warranty', 5),

  (@mw,  '30L capacity with grill & convection', 1),
  (@mw,  '10 power levels for precise cooking', 2),
  (@mw,  '40 auto-cook menus', 3),
  (@mw,  'Child lock & deodorizer function', 4),
  (@mw,  'One-touch steam clean', 5),

  (@vc,  '2200W motor with cyclone suction', 1),
  (@vc,  'HEPA filter – captures 99.9% particles', 2),
  (@vc,  '2L bagless dust container', 3),
  (@vc,  '5 interchangeable nozzle attachments', 4),
  (@vc,  'Telescopic handle, 7m cord length', 5),

  (@kb,  '1.5L high-speed blender (800W)', 1),
  (@kb,  '4-slice stainless steel toaster', 2),
  (@kb,  '1.7L fast-boil kettle', 3),
  (@kb,  'Food processor with 5 attachments', 4),
  (@kb,  'Matching design set – 2-year warranty', 5),

  (@df,  '14 Cu.Ft (396L) total storage capacity', 1),
  (@df,  'Fast freeze function in under 2 hours', 2),
  (@df,  'Lockable lid for security', 3),
  (@df,  'R600a eco-friendly refrigerant', 4),
  (@df,  'Low-noise compressor, 3-year warranty', 5);

-- ─────────────────────────────────────────
-- SEED: Product Meta
-- ─────────────────────────────────────────
INSERT IGNORE INTO product_meta (product_id, meta_key, meta_value) VALUES
  (@ref, 'brand', 'Haier'), (@ref, 'warranty', '5 years'), (@ref, 'weight_kg', '65'),
  (@wsh, 'brand', 'Samsung'), (@wsh, 'warranty', '2 years'), (@wsh, 'capacity_kg', '8'),
  (@tv,  'brand', 'TCL'), (@tv,  'warranty', '1 year'), (@tv,  'screen_size', '55 inch'),
  (@ac,  'brand', 'Gree'), (@ac,  'warranty', '10 years'), (@ac,  'capacity_ton', '1.5'),
  (@mw,  'brand', 'Dawlance'), (@mw,  'warranty', '1 year'), (@mw,  'capacity_litre', '30'),
  (@vc,  'brand', 'Philips'), (@vc,  'warranty', '2 years'), (@vc,  'power_w', '2200'),
  (@kb,  'brand', 'Anex'), (@kb,  'warranty', '2 years'),
  (@df,  'brand', 'PEL'), (@df,  'warranty', '3 years'), (@df,  'capacity_cuft', '14');
