// routes/cart.js
const router = require('express').Router();
const ctrl   = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

router.use(protect);   // all cart routes require login

router.get('/',               ctrl.getCart);
router.post('/',              ctrl.addToCart);
router.put('/:cartItemId',    ctrl.updateCartItem);
router.delete('/',            ctrl.clearCart);
router.delete('/:cartItemId', ctrl.removeFromCart);

module.exports = router;
