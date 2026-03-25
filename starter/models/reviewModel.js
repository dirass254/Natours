const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review cannot be empty'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating cannot be empty'],
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour'],
    },

    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Preventing duplicate reviews: A user should not be able to write more than one review for the same tour.

reviewSchema.index({ tour: 1, user: 1 }, { unique: true });
// we commented this out because we want to populate only the user data and not the tour data in the review

// reviewSchema.pre(/^find/, function (next) {
//   this.populate({
//     path: 'tour',
//     select: 'name',
//   }).populate({
//     path: 'user',
//     select: 'name photo',
//   });
// });

reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name photo',
  });
});

reviewSchema.statics.calculateAverageRatings = async function (tourId) {
  //console.log(tourId);
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);
  //console.log(stats);

  await Tour.findByIdAndUpdate(tourId, {
    ratingsQuantity: stats[0]?.nRating || 0,
    ratingsAverage: stats[0]?.avgRating || 4.5,
  });
};

// This middleware runs after a review is saved to the database. It calculates the average rating and the number of ratings for the tour associated with the review and updates the corresponding fields in the Tour model.
// The 'this' keyword refers to the current review document that was just saved. The 'constructor' property allows us to access the static method 'calculateAverageRatings' defined on the Review model, which performs the aggregation to calculate the average rating and rating quantity for the specified tour.
reviewSchema.post('save', function () {
  // this points to current review
  this.constructor.calculateAverageRatings(this.tour);
});

//findByIdAndUpdate
//findByIdAndDelete
reviewSchema.post(/^findOneAnd/, async function (doc) {
  if (doc) await doc.constructor.calculateAverageRatings(doc.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
