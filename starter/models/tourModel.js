'use strict';

const mongoose = require('mongoose');
// eslint-disable-next-line import/no-extraneous-dependencies
const slugify = require('slugify');

//const User = require('./userModel');
// eslint-disable-next-line import/no-extraneous-dependencies
//const validator = require('validator');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name must have less or equal than 40 characters'],
      minlength: [10, 'A tour name must have more or equal than 10 characters'],
      // // eslint-disable-next-line no-undef
      // validate: [validator.isAlpha, 'Tour name must only contain characters'],
    },
    slug: {
      type: String,
    },
    secretTour: {
      type: Boolean,
      default: false,
    },
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult',
      },
    },

    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10, // e.g., 4.6666 => 46.666 => 47 => 4.7
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // this only points to current doc on NEW document creation
          // it works only on save and create, not on update
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) should be below regular price',
      },
    },
    summary: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      //required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],

    startLocation: {
      // GeoJSON
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number], // [longitude, latitude]
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);
// The purpose of indexes is to improve the performance of read operations on the database. By creating an index on a field, MongoDB can quickly locate and retrieve documents based on that field, rather than having to scan the entire collection. This is especially important for large collections where scanning every document would be inefficient.
// Single field index
//tourSchema.index({ price: 1 });
// Compound index: price ascending, ratingsAverage descending
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ startLocation: '2dsphere' }); // for geospatial queries

// Virtual property: duration in weeks

// tourSchema.virtual('durationWeeks').get(function () {
//   return this.duration / 7;
// });
// Virtual property: price with tax
tourSchema.virtual('priceWithTax').get(function () {
  return this.price * 1.2;
});

// virtual populate: reviews for each tour
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

// Document middleware: runs before .save() and .create() but not before .insertMany() or .update()
// tourSchema.pre('save', async function (next) {
//   const guidesPromise = this.guides.map(async (id) => await User.findById(id));
//   this.guides = await Promise.all(guidesPromise);
//   //next();
// });
// eslint-disable-next-line prefer-arrow-callback
tourSchema.pre('save', function (next) {
  // 1. Lowercase all letters
  const lower = this.name.toLowerCase();
  // 2. Replace spaces and special characters with hyphens
  const hyphenated = lower.replace(/[^a-z0-9]+/g, '-');
  // 3. Remove leading/trailing hyphens and non-alphanumeric characters
  const cleaned = hyphenated.replace(/^-+|-+$/g, '');
  // Use slugify for robust slug generation
  this.slug = slugify(this.name, { lower: true });
  // For demonstration, log each step
  console.log('Original:', this.name);
  console.log('Lowercase:', lower);
  console.log('Hyphenated:', hyphenated);
  console.log('Cleaned:', cleaned);
  console.log('Slugify:', this.slug);
  //next();
});

tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });
});

// // eslint-disable-next-line prefer-arrow-callback
// tourSchema.pre('save', function () {
//   console.log('Will save document...');
// });

// Query middleware: runs before .find() and .findOne()

// we can use regex to apply this middleware to all query that starts with find (find, findOne, findById, etc.)
// eslint-disable-next-line prefer-arrow-callback

// tourSchema.pre(/^find/, function (next) {
//   this.find({ secretTour: { $ne: true } });
//   this.start = Date.now();
//   //next();
// });

// eslint-disable-next-line prefer-arrow-callback
tourSchema.post(/^find/, function (docs) {
  //console.log(`Query took ${Date.now() - this.start} milliseconds!`);
});

// Aggregation middleware: runs before .aggregate()
tourSchema.pre('aggregate', function (next) {
  if (!(this.pipeline()[0] && this.pipeline()[0].$geoNear))
    // if the first stage is NOT $geoNear, prepend the $match stage to filter secret tours
    this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
  //console.log(this.pipeline());
});

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
