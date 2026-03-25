const express = require('express');

const bookingController = require('../controllers/bookingController');
const { protect, restrictTo } = require('../controllers/authController');

const router = express.Router();

router.get(
  '/checkout-session/:tourId',
  protect,
  bookingController.getCheckoutSession,
);

router.use(protect);
router.use(restrictTo('admin', 'lead-guide'));

router.get('/', bookingController.getAllBookings);
router.get('/:id', bookingController.getBooking);

router.post('/', bookingController.createBooking);
router.patch('/:id', bookingController.updateBooking);
router.delete('/:id', bookingController.deleteBooking);

module.exports = router;
