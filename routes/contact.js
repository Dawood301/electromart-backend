// routes/contact.js
const router  = require('express').Router();
const { body } = require('express-validator');
const ctrl    = require('../controllers/contactController');
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.post('/',
  body('name').notEmpty(),
  body('email').isEmail(),
  body('subject').notEmpty(),
  body('message').isLength({ min: 10 }),
  validate,
  ctrl.submitMessage);

router.get('/',          protect, adminOnly, ctrl.getMessages);
router.patch('/:id/read', protect, adminOnly, ctrl.markRead);
router.delete('/:id',    protect, adminOnly, ctrl.deleteMessage);

module.exports = router;
