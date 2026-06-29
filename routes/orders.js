// routes/orders.js
const router = require('express').Router();
const ctrl   = require('../controllers/orderController');
const { protect, adminOnly } = require('../middleware/auth');

// Guest-friendly checkout (protect is optional — resolved inside controller)
router.post('/', ctrl.createOrder);

// Customer
router.get('/my', protect, ctrl.getMyOrders);
router.get('/:id', protect, ctrl.getOrder);

// Admin
router.get('/',         protect, adminOnly, ctrl.getAllOrders);
router.put('/:id/status', protect, adminOnly, ctrl.updateOrderStatus);

module.exports = router;
