const Review = require('../models/reviewModel');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');
//const catchAsync = require('../utils/catchAsync');

exports.setUserTourIds = (req, res, next) => {
  // Allow nested routes

  // if the tour and user are not specified in the request body, set them to the values from the URL and the authenticated user
  if (!req.body.tour) req.body.tour = req.params.tourId;
  if (!req.body.user) req.body.user = req.user.id;
  next();
};

exports.getAllReviews = factory.getAll(Review);
exports.createReview = factory.createOne(Review);
exports.getReview = factory.getOne(Review);
exports.deleteReview = factory.deleteOne(Review);
exports.updateReview = factory.updateOne(Review);
