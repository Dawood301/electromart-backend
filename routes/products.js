// routes/products.js
const router  = require('express').Router();
const ctrl    = require('../controllers/productController');
const { protect, adminOnly } = require('../middleware/auth');
const upload  = require('../middleware/upload');

// Public
router.get('/',          ctrl.getProducts);
router.get('/featured',  ctrl.getFeatured);
router.get('/:slug',     ctrl.getProduct);

// Admin
router.post('/',                                 protect, adminOnly, ctrl.createProduct);
router.put('/:id',                               protect, adminOnly, ctrl.updateProduct);
router.delete('/:id',                            protect, adminOnly, ctrl.deleteProduct);
router.post('/:id/images', upload.single('image'), protect, adminOnly, ctrl.uploadProductImage);
router.delete('/:id/images/:imageId',            protect, adminOnly, ctrl.deleteProductImage);

module.exports = router;
