# ElectroMart — Backend API

Node.js · Express · MySQL — fully extensible REST API for the ElectroMart frontend.

---

## Quick Start

### 1. Prerequisites
- Node.js ≥ 18
- MySQL ≥ 8.0

### 2. Install dependencies
```bash
cd electromart-backend
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env — set DB_PASSWORD and JWT_SECRET at minimum
```

### 4. Create database & seed data
```bash
# Create tables + seed categories, brands & 8 products
mysql -u root -p < schema.sql

# Create the admin user
node seed.js
```

### 5. Start the server
```bash
npm run dev      # development (nodemon — auto-restart)
npm start        # production
```

Server runs at **http://localhost:5000**

Health check: `GET http://localhost:5000/api/health`

---

## Project Structure

```
electromart-backend/
├── server.js               # App entry — Express setup, routes mount
├── schema.sql              # DB schema + seed data (run once)
├── seed.js                 # Admin account seed (run once)
├── .env.example            # Copy to .env
│
├── config/
│   └── db.js               # MySQL connection pool
│
├── controllers/            # Business logic
│   ├── authController.js
│   ├── productController.js
│   ├── categoryController.js
│   ├── cartController.js
│   ├── orderController.js
│   ├── contactController.js
│   └── adminController.js
│
├── middleware/
│   ├── auth.js             # JWT protect + adminOnly guards
│   ├── errorHandler.js     # Central error handler
│   ├── validate.js         # express-validator runner
│   └── upload.js           # Multer image upload config
│
├── routes/
│   ├── auth.js
│   ├── products.js
│   ├── categories.js
│   ├── cart.js
│   ├── orders.js
│   ├── contact.js
│   └── admin.js
│
├── utils/
│   └── helpers.js          # sendSuccess, paginate, generateOrderNumber
│
└── uploads/                # Auto-created — stores product images
```

---

## API Reference

All responses follow this envelope:
```json
{ "success": true, "message": "OK", ...data }
{ "success": false, "message": "Error description" }
```

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register new customer |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | 🔒 User | Get own profile |
| PUT | `/api/auth/me` | 🔒 User | Update name/phone |
| PUT | `/api/auth/change-password` | 🔒 User | Change password |

**Login response:**
```json
{ "token": "eyJ...", "user": { "id": 1, "name": "...", "email": "...", "role": "customer" } }
```

Pass token as: `Authorization: Bearer <token>`

---

### Products
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/products` | — | List products (filterable) |
| GET | `/api/products/featured` | — | Featured products for hero |
| GET | `/api/products/:slug` | — | Single product with images, features, specs |
| POST | `/api/products` | 🔒 Admin | Create product |
| PUT | `/api/products/:id` | 🔒 Admin | Update product |
| DELETE | `/api/products/:id` | 🔒 Admin | Soft-delete product |
| POST | `/api/products/:id/images` | 🔒 Admin | Upload product image |
| DELETE | `/api/products/:id/images/:imageId` | 🔒 Admin | Remove product image |

**Query parameters for GET /api/products:**
```
category=cooling        Filter by category slug
brand=lg                Filter by brand slug
featured=true           Only featured products
search=refrigerator     Full-text search
sort=price_asc          price_asc | price_desc | newest | name
min_price=10000
max_price=100000
page=1
limit=12
```

**Create product body:**
```json
{
  "category_id": 1,
  "brand_id": 4,
  "name": "Smart Refrigerator Pro",
  "short_desc": "Next-gen cooling",
  "price": 95000,
  "old_price": 110000,
  "stock_qty": 20,
  "badge": "New Arrival",
  "is_featured": true,
  "features": ["Inverter compressor", "Frost-free"],
  "specs": [{ "key": "Capacity", "value": "14 Cu.Ft" }],
  "images": [{ "url": "images/product.jpg", "alt": "Product image" }]
}
```

---

### Categories
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/categories` | — | All active categories with product counts |
| GET | `/api/categories/:slug` | — | Single category |
| POST | `/api/categories` | 🔒 Admin | Create category |
| PUT | `/api/categories/:id` | 🔒 Admin | Update category |
| DELETE | `/api/categories/:id` | 🔒 Admin | Soft-delete |

---

### Cart (requires login)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/cart` | 🔒 User | Get cart with product details |
| POST | `/api/cart` | 🔒 User | Add item `{ product_id, quantity }` |
| PUT | `/api/cart/:cartItemId` | 🔒 User | Update quantity `{ quantity }` |
| DELETE | `/api/cart/:cartItemId` | 🔒 User | Remove item |
| DELETE | `/api/cart` | 🔒 User | Clear entire cart |

---

### Orders
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/orders` | Optional | Place order (guest or logged-in) |
| GET | `/api/orders/my` | 🔒 User | Customer's own orders |
| GET | `/api/orders/:id` | 🔒 User | Single order detail |
| GET | `/api/orders` | 🔒 Admin | All orders (paginated) |
| PUT | `/api/orders/:id/status` | 🔒 Admin | Update status/payment |

**Place order body:**
```json
{
  "items": [
    { "product_id": 1, "quantity": 1 },
    { "product_id": 5, "quantity": 2 }
  ],
  "guest_name": "Ahmed Ali",
  "guest_email": "ahmed@example.com",
  "guest_phone": "0300-1234567",
  "shipping_address": {
    "full_name": "Ahmed Ali",
    "phone": "0300-1234567",
    "address_line": "House 12, Street 5",
    "city": "Gujranwala",
    "province": "Punjab"
  },
  "payment_method": "cod",
  "coupon_code": "SAVE10",
  "notes": "Please call before delivery"
}
```

Order statuses: `pending → confirmed → processing → shipped → delivered`

---

### Contact
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/contact` | — | Submit contact message |
| GET | `/api/contact` | 🔒 Admin | All messages |
| PATCH | `/api/contact/:id/read` | 🔒 Admin | Mark as read |
| DELETE | `/api/contact/:id` | 🔒 Admin | Delete message |

---

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Dashboard stats + revenue chart + top products |
| GET | `/api/admin/users` | All users (paginated, searchable) |
| PATCH | `/api/admin/users/:id/toggle` | Enable/disable user |
| GET | `/api/admin/brands` | All brands |
| POST | `/api/admin/brands` | Create brand |
| GET | `/api/admin/coupons` | All coupons |
| POST | `/api/admin/coupons` | Create coupon |
| DELETE | `/api/admin/coupons/:id` | Deactivate coupon |

---

## Connecting the Frontend

In your `templatemo-3d-coverflow-scripts.js`, replace the hardcoded `productData` array with API calls:

```javascript
const API = 'http://localhost:5000/api';

// Load featured products for coverflow
async function loadFeatured() {
  const res  = await fetch(`${API}/products/featured`);
  const data = await res.json();
  // data.products → array of products with primary_image, name, price, etc.
  return data.products;
}

// Load all products (with optional filters)
async function loadProducts(filters = {}) {
  const params = new URLSearchParams(filters);
  const res    = await fetch(`${API}/products?${params}`);
  const data   = await res.json();
  return data; // { products, pagination }
}

// Place an order
async function checkout(orderData) {
  const res = await fetch(`${API}/orders`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(orderData),
  });
  return res.json();
}

// Submit contact form
async function submitContact(formData) {
  const res = await fetch(`${API}/contact`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(formData),
  });
  return res.json();
}
```

---

## Extensibility Guide

The backend is designed to grow with your needs:

| Feature | How to add |
|---------|-----------|
| **New product category** | `POST /api/categories` — no code changes |
| **New product** | `POST /api/products` with any number of features/specs/images |
| **Sub-categories** | Set `parent_id` when creating a category |
| **New brand** | `POST /api/admin/brands` |
| **Discount coupon** | `POST /api/admin/coupons` (percent or fixed PKR) |
| **Product search** | `GET /api/products?search=keyword` — already implemented |
| **Price filtering** | `GET /api/products?min_price=X&max_price=Y` |
| **Multiple images** | `POST /api/products/:id/images` (unlimited) |
| **Product specs table** | Already in DB (`product_specs`) — pass `specs` array on create |
| **Guest checkout** | Already supported — no login required to place an order |
| **Shipping costs** | Extend `orderController.js` line: `const shipping_fee = 0` |
| **Email notifications** | Add `nodemailer` calls inside `orderController.createOrder` |
| **Payment gateway** | Add a `/api/payments` route, update `payment_status` on webhook |
| **Reviews & ratings** | Add `product_reviews` table + controller |
| **Wishlist** | Add `wishlists` table + controller |
