// routes/auth.js
const router  = require('express').Router();
const { body } = require('express-validator');
const ctrl    = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const passwordRule = body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters');

router.post('/register',
  body('name').notEmpty().withMessage('Name required'),
  body('email').isEmail().withMessage('Valid email required'),
  passwordRule,
  validate,
  ctrl.register);

router.post('/login',
  body('email').isEmail(),
  body('password').notEmpty(),
  validate,
  ctrl.login);

router.get('/me',     protect, ctrl.getMe);
router.put('/me',     protect, ctrl.updateMe);
router.put('/change-password',
  protect,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
  validate,
  ctrl.changePassword);

module.exports = router;
