const AppError = require('../utils/appError');

// CastError: Mongoose throws this when a value cannot be cast to the expected type.
// Most common case: an invalid MongoDB ObjectId in the URL (e.g. /tours/abc123xyz)
// err.path = the field name (e.g. '_id'), err.value = the bad value provided.
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

// MongoDB error code 11000 = duplicate key violation.
// Happens when you try to insert a document with a value that already exists
// on a field marked as unique (e.g. duplicate email address).
// err.keyValue = { fieldName: duplicateValue }, so we grab the first (and usually only) value.
const handleDuplicateFieldsDB = (err) => {
  const value = Object.values(err.keyValue)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

// ValidationError: Mongoose throws this when a document fails schema validation
// (e.g. a required field is missing, a value is below the minimum, etc.).
// A single save/create can fail multiple validators, so we collect all messages
// from err.errors (an object keyed by field name) and join them into one string.
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// JsonWebTokenError: thrown by jwt.verify() when the token's signature is invalid
// (i.e. the token has been tampered with, or signed with a different secret).
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

// TokenExpiredError: thrown by jwt.verify() when the token's exp timestamp is in the past.
// The token WAS valid but its lifetime (JWT_EXPIRES_IN) has passed.
const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

const sendErrorDev = (err, req, res) => {
  // A) API errors
  if (req.originalUrl.startsWith('/api')) {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }
  // B) Rendered website errors
  res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    message: err.message,
  });
};

const sendErrorProd = (err, req, res) => {
  // A) API errors
  if (req.originalUrl.startsWith('/api')) {
    // isOperational: a flag we manually set on AppError instances (see utils/appError.js).
    // true  → "operational" error: predictable, user-caused (wrong input, not found, etc.)
    //         Safe to send the real message to the client.
    // false → programmer error or unexpected crash (bug, library failure, etc.)
    //         Never expose internals — send a generic message and log details server-side.
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
      // Programming or other unknown errors
    }
    console.error('ERROR 💥', err);
    // Send generic message
    return res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!',
    });
  }
  // B) Rendered website errors
  // Recognize AppError and operational errors
  if (err.isOperational) {
    return res.status(err.statusCode).render('error', {
      title: 'Something went wrong!',
      message: err.message,
    });
  }
  // Programming or other unknown errors
  // Log the error for developers
  console.error('ERROR 💥', err);
  // Send generic message
  return res.status(500).render('error', {
    title: 'Something went wrong!',
    message: 'Please try again later.',
  });
};

// Express global error-handling middleware — recognised by its 4 parameters (err, req, res, next).
// Any call to next(err) anywhere in the app lands here.
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    // In development: send full error details (stack trace, raw error object)
    // so developers can diagnose problems quickly.
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    // Spread { ...err } to get a shallow copy of the error's OWN enumerable properties.
    // IMPORTANT: JavaScript Error objects store `.message` as a NON-ENUMERABLE property,
    // which means the spread operator { ...err } does NOT copy it!  We must copy it
    // manually on the next line. This is a well-known JS gotcha.
    let error = { ...err };
    error.message = err.message; // manually copy the non-enumerable message property
    console.log('DEBUG error object before type checks:', error);
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError')
      error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    sendErrorProd(error, req, res);
  }
};
