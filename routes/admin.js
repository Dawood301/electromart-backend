// routes/admin.js
const router = require('express').Router();
const ctrl   = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);   // all admin routes locked down

router.get('/stats',                ctrl.getDashboardStats);
router.get('/users',                ctrl.getUsers);
router.patch('/users/:id/toggle',   ctrl.toggleUserStatus);
router.get('/brands',               ctrl.getBrands);
router.post('/brands',              ctrl.createBrand);
router.get('/coupons',              ctrl.getCoupons);
router.post('/coupons',             ctrl.createCoupon);
router.delete('/coupons/:id',       ctrl.deleteCoupon);

module.exports = router;
