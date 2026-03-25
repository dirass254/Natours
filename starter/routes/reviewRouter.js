const {
  createReview,
  getAllReviews,
  getReview,
  updateReview,
  deleteReview,
  setUserTourIds,
} = require('../controllers/reviewController');
const { protect, restrictTo } = require('../controllers/authController');
const express = require('express');

const router = express.Router({ mergeParams: true });

router.use(protect);
router
  .route('/')
  .get(getAllReviews)
  .post(restrictTo('user'), setUserTourIds, createReview);

router
  .route('/:id')
  .get(getReview)
  .patch(restrictTo('user', 'admin'), updateReview)
  .delete(restrictTo('user', 'admin'), deleteReview);

module.exports = router;
