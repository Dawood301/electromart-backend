-- =============================================================
--  ElectroMart — MySQL Schema
--  Fully normalized, extensible design
--  Run once:  mysql -u root -p < schema.sql
-- =============================================================

CREATE DATABASE IF NOT EXISTS electromart
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE electromart;

-- -------------------------------------------------------------
-- 1. USERS  (customers + admins)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(180)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  phone         VARCHAR(20)   DEFAULT NULL,
  role          ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role  (role)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 2. CATEGORIES  (unlimited, supports sub-categories)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  slug        VARCHAR(120)  NOT NULL UNIQUE,
  parent_id   INT UNSIGNED  DEFAULT NULL,        -- NULL = top-level
  description TEXT          DEFAULT NULL,
  image_url   VARCHAR(500)  DEFAULT NULL,
  sort_order  INT           NOT NULL DEFAULT 0,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_parent (parent_id),
  INDEX idx_slug   (slug)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 3. BRANDS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brands (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  slug       VARCHAR(120) NOT NULL UNIQUE,
  logo_url   VARCHAR(500) DEFAULT NULL,
  is_active  TINYINT(1)  NOT NULL DEFAULT 1,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 4. PRODUCTS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  category_id     INT UNSIGNED  NOT NULL,
  brand_id        INT UNSIGNED  DEFAULT NULL,
  name            VARCHAR(200)  NOT NULL,
  slug            VARCHAR(220)  NOT NULL UNIQUE,
  short_desc      VARCHAR(500)  DEFAULT NULL,
  description     TEXT          DEFAULT NULL,
  price           DECIMAL(12,2) NOT NULL,
  old_price       DECIMAL(12,2) DEFAULT NULL,         -- strike-through price
  stock_qty       INT           NOT NULL DEFAULT 0,
  sku             VARCHAR(100)  DEFAULT NULL UNIQUE,
  badge           VARCHAR(60)   DEFAULT NULL,          -- "Best Seller", "New", "Sale" …
  is_featured     TINYINT(1)    NOT NULL DEFAULT 0,    -- show in hero coverflow
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  sort_order      INT           NOT NULL DEFAULT 0,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (brand_id)    REFERENCES brands(id) ON DELETE SET NULL,
  INDEX idx_category  (category_id),
  INDEX idx_featured  (is_featured),
  INDEX idx_active    (is_active),
  INDEX idx_price     (price)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 5. PRODUCT IMAGES  (multiple images per product)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_images (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  image_url   VARCHAR(500) NOT NULL,
  alt_text    VARCHAR(200) DEFAULT NULL,
  is_primary  TINYINT(1)  NOT NULL DEFAULT 0,
  sort_order  INT         NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (product_id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 6. PRODUCT FEATURES  (bullet points shown in Quick View)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_features (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  feature    VARCHAR(300) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (product_id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 7. PRODUCT SPECIFICATIONS  (key-value pairs, e.g. Wattage: 2200W)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_specs (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  spec_key    VARCHAR(100) NOT NULL,
  spec_value  VARCHAR(300) NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (product_id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 8. ADDRESSES  (re-usable for users)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS addresses (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  label       VARCHAR(60)  DEFAULT 'Home',
  full_name   VARCHAR(100) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  address_line VARCHAR(300) NOT NULL,
  city        VARCHAR(100) NOT NULL,
  province    VARCHAR(100) DEFAULT NULL,
  postal_code VARCHAR(20)  DEFAULT NULL,
  is_default  TINYINT(1)  NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 9. ORDERS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  order_number    VARCHAR(30)   NOT NULL UNIQUE,        -- e.g. EM-20260001
  user_id         INT UNSIGNED  DEFAULT NULL,           -- NULL = guest checkout
  guest_name      VARCHAR(100)  DEFAULT NULL,
  guest_email     VARCHAR(180)  DEFAULT NULL,
  guest_phone     VARCHAR(20)   DEFAULT NULL,
  shipping_addr   TEXT          DEFAULT NULL,           -- JSON snapshot
  status          ENUM(
                    'pending','confirmed','processing',
                    'shipped','delivered','cancelled','refunded'
                  ) NOT NULL DEFAULT 'pending',
  payment_method  ENUM('cod','bank_transfer','online') NOT NULL DEFAULT 'cod',
  payment_status  ENUM('unpaid','paid','refunded')     NOT NULL DEFAULT 'unpaid',
  subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount        DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_fee    DECIMAL(12,2) NOT NULL DEFAULT 0,
  total           DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes           TEXT          DEFAULT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user      (user_id),
  INDEX idx_status    (status),
  INDEX idx_created   (created_at)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 10. ORDER ITEMS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED  NOT NULL,
  product_id  INT UNSIGNED  DEFAULT NULL,    -- NULL if product was deleted later
  product_name VARCHAR(200) NOT NULL,        -- snapshot at time of order
  unit_price  DECIMAL(12,2) NOT NULL,
  quantity    INT           NOT NULL DEFAULT 1,
  subtotal    DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_order (order_id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 11. CART  (server-side cart for logged-in users)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cart_items (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  product_id  INT UNSIGNED NOT NULL,
  quantity    INT          NOT NULL DEFAULT 1,
  added_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_product (user_id, product_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 12. CONTACT / SUPPORT MESSAGES
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_messages (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED DEFAULT NULL,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(180) NOT NULL,
  subject     VARCHAR(200) NOT NULL,
  message     TEXT         NOT NULL,
  is_read     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_read (is_read)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 13. COUPONS / DISCOUNT CODES
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
  id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(50)   NOT NULL UNIQUE,
  type            ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
  value           DECIMAL(10,2) NOT NULL,
  min_order_amt   DECIMAL(12,2) NOT NULL DEFAULT 0,
  max_uses        INT           DEFAULT NULL,     -- NULL = unlimited
  used_count      INT           NOT NULL DEFAULT 0,
  expires_at      DATETIME      DEFAULT NULL,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================================
--  SEED DATA — Categories & initial products
-- =============================================================

INSERT INTO categories (name, slug, description, sort_order) VALUES
  ('Cooling',       'cooling',       'Refrigerators, ACs, freezers',        1),
  ('Laundry',       'laundry',       'Washing machines & dryers',           2),
  ('Entertainment', 'entertainment', 'TVs, home theatre & audio',           3),
  ('Kitchen',       'kitchen',       'Microwaves, blenders & small appliances', 4),
  ('Cleaning',      'cleaning',      'Vacuum cleaners & floor care',        5);

INSERT INTO brands (name, slug) VALUES
  ('Generic','generic'),
  ('Samsung','samsung'),
  ('LG','lg'),
  ('Haier','haier'),
  ('Dawlance','dawlance'),
  ('PEL','pel'),
  ('TCL','tcl');

-- Products (matching the 8 products from the frontend)
INSERT INTO products
  (category_id, brand_id, name, slug, short_desc, price, old_price, stock_qty, badge, is_featured, sort_order)
VALUES
  (1,4,'Smart Refrigerator','smart-refrigerator',
   'Inverter technology, energy-saving, frost-free with smart sensors',
   85000,99000,15,'Best Seller',1,1),

  (2,3,'Automatic Washing Machine','automatic-washing-machine',
   'Premium front-load, 8kg capacity, 15 wash programs',
   65000,74000,10,NULL,1,2),

  (3,2,'LED Smart TV 55"','led-smart-tv-55',
   '4K UHD Android Smart TV, built-in Wi-Fi, Dolby Audio',
   120000,140000,8,'Hot Deal',1,3),

  (1,6,'Inverter Air Conditioner','inverter-air-conditioner',
   '1.5 ton DC inverter, 5-star energy rating, whisper-quiet',
   95000,110000,12,NULL,1,4),

  (4,1,'Microwave Oven','microwave-oven',
   '30L convection with grill, 10 power levels, 40 auto-cook recipes',
   22000,28000,20,'Sale',1,5),

  (5,1,'Vacuum Cleaner','vacuum-cleaner',
   'Powerful 2200W bagless, HEPA filtration, multiple attachments',
   18000,23000,18,NULL,1,6),

  (4,1,'Kitchen Appliances Bundle','kitchen-appliances-bundle',
   'Blender, toaster, kettle & food processor combo',
   35000,48000,9,'Bundle',1,7),

  (1,5,'Deep Freezer 14 Cu.Ft','deep-freezer-14cuft',
   'Large-capacity chest freezer, fast-freeze, lockable lid',
   55000,63000,7,NULL,1,8);

-- Product images
INSERT INTO product_images (product_id, image_url, alt_text, is_primary) VALUES
  (1,'images/Refrigerator.jpg',      'Smart Refrigerator',         1),
  (2,'images/Washing Machine.jpg',   'Automatic Washing Machine',  1),
  (3,'images/LED Smart TV.jpg',      'LED Smart TV 55"',           1),
  (4,'images/Air Conditioner.jpg',   'Inverter Air Conditioner',   1),
  (5,'images/Microwave.jpg',         'Microwave Oven',             1),
  (6,'images/Vacuum Cleaner.jpg',    'Vacuum Cleaner',             1),
  (7,'images/Kitchen Appliances.jpg','Kitchen Appliances Bundle',  1);

-- Product features
INSERT INTO product_features (product_id, feature, sort_order) VALUES
  (1,'Inverter compressor – saves up to 40% energy',1),
  (1,'Twin cooling system (fridge + freezer separate)',2),
  (1,'Frost-free with auto defrost',3),
  (1,'Smart sensor for humidity control',4),
  (1,'5-year compressor warranty',5),

  (2,'8 kg capacity, suitable for large families',1),
  (2,'15 wash programs including delicate & quick wash',2),
  (2,'1200 RPM spin speed',3),
  (2,'Child safety lock',4),
  (2,'Energy Star rated – 5 star',5),

  (3,'55" 4K UHD display (3840×2160)',1),
  (3,'Android 11 OS with Google Play Store',2),
  (3,'Dolby Vision & Dolby Atmos Audio',3),
  (3,'Built-in Wi-Fi & Bluetooth 5.0',4),
  (3,'3x HDMI, 2x USB ports',5),

  (4,'1.5 ton capacity – ideal for medium rooms',1),
  (4,'DC Inverter – 50% energy savings',2),
  (4,'5-star energy rating',3),
  (4,'WiFi control via smartphone app',4),
  (4,'Auto-clean function, 10-year warranty',5),

  (5,'30L capacity with grill & convection',1),
  (5,'10 power levels for precise cooking',2),
  (5,'40 auto-cook menus',3),
  (5,'Child lock & deodorizer function',4),
  (5,'One-touch steam clean',5),

  (6,'2200W motor with cyclone suction',1),
  (6,'HEPA filter – captures 99.9% particles',2),
  (6,'2L bagless dust container',3),
  (6,'5 interchangeable nozzle attachments',4),
  (6,'Telescopic handle, 7m cord length',5),

  (7,'1.5L high-speed blender (800W)',1),
  (7,'4-slice stainless steel toaster',2),
  (7,'1.7L fast-boil kettle',3),
  (7,'Food processor with 5 attachments',4),
  (7,'Matching design set – 2-year warranty',5),

  (8,'14 Cu.Ft (396L) total storage capacity',1),
  (8,'Fast freeze function in under 2 hours',2),
  (8,'Lockable lid for security',3),
  (8,'R600a eco-friendly refrigerant',4),
  (8,'Low-noise compressor, 3-year warranty',5);
