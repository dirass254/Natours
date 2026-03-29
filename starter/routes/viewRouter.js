const express = require('express');

const { isLoggedIn, protect } = require('../controllers/authController');
const bookingController = require('../controllers/bookingController');
const {
  getOverview,
  getTour,
  getLoginForm,
  getAccount,
  updateUserData,
  getMyTours,
} = require('../controllers/viewController');
const router = express.Router();

// we do not need to pass the isLoggedIn middleware to routes that require authentication to avoid querying the user twice
// use isLogged in for all routes that does not require authentication (e.g. overview and tour page) to check if the user is logged in and then render the appropriate header (with login/logout button)
router.get('/', isLoggedIn, getOverview);
router.get('/tour/:slug', isLoggedIn, getTour);
router.get('/login', isLoggedIn, getLoginForm);
router.get('/me', protect, getAccount);
router.get(
  '/my-tours',
  // we passed this middleware before because we were using the query parameters to create the booking in the createBookingCheckout controller, but now we are using the webhook to create the booking, so we do not need to pass this middleware anymore.
  // Instead, we will use the protect middleware to protect this route and then use the getMyTours controller to get the tours that the user has booked and then render the my-tours template with the data of the tours that the user has booked.
  // bookingController.createBookingCheckout,
  protect,
  getMyTours,
);

router.post('/submit-user-data', protect, updateUserData);
module.exports = router;
