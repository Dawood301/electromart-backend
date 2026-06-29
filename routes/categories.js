// routes/categories.js
const router = require('express').Router();
const ctrl   = require('../controllers/categoryController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/',       ctrl.getCategories);
router.get('/:slug',  ctrl.getCategory);
router.post('/',      protect, adminOnly, ctrl.createCategory);
router.put('/:id',    protect, adminOnly, ctrl.updateCategory);
router.delete('/:id', protect, adminOnly, ctrl.deleteCategory);

module.exports = router;
