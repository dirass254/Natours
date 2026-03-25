'use strict';

// promisify: converts a callback-style function into one that returns a Promise.
// jwt.verify() normally takes a callback — promisify lets us await it instead.
const { promisify } = require('util'); // Built-in Node.js module, no install needed

// eslint-disable-next-line import/no-extraneous-dependencies
// jsonwebtoken: creates (sign) and verifies JWT tokens. Requires: npm install jsonwebtoken
const jwt = require('jsonwebtoken');

// crypto: built-in Node.js module for hashing and cryptographic operations.
// Used here to hash the password-reset token before storing/comparing it in the DB.
const crypto = require('crypto');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

// jwt.sign(payload, secret, options) → creates a signed JWT string.
// payload: { id } — we embed only the user's _id so we can look them up later.
// secret: a long random string only the server knows — used to sign & verify tokens.
// expiresIn: after this duration the token is invalid (e.g. '90d', '1h').
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};
// Single helper used by signup, login, and password reset to avoid repeating token logic.
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    // Convert JWT_COOKIE_EXPIRES_IN (days) → milliseconds: days * 24h * 60m * 60s * 1000ms
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    // httpOnly: true → the cookie CANNOT be read or modified by browser JavaScript.
    // This is a critical XSS (cross-site scripting) defence — a malicious script
    // injected into the page is unable to steal the JWT cookie.
    httpOnly: true,
  };

  // secure: true → cookie is only sent over HTTPS. We apply this in production only
  // because localhost (dev) runs on HTTP and would silently drop the cookie otherwise.
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output — it was fetched with select('+password') during login,
  // so we must strip it before sending the user object back in the JSON response.
  // Setting to undefined excludes the field from JSON.stringify().
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};
exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    //passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role,
  });

  // Send welcome email first before sending the JWT, because the email contains a URL with the JWT token that we need to generate first.
  await new Email(
    newUser,
    `${req.protocol}://${req.get('host')}/me`,
  ).sendWelcome();
  //console.log(url);

  // After the welcome email is sent, we can create and send the JWT token to log the user in immediately after signing up.
  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }
  // 2) Check if user exists && password is correct
  // .select('+password'): the password field has { select: false } in the schema so it is
  // EXCLUDED from all queries by default (security). The '+' prefix forces its inclusion
  // here, specifically because we need to compare it during login.
  const user = await User.findOne({ email }).select('+password');

  // We check both conditions in one line intentionally: if the user doesn't exist we
  // never call correctPassword() — this also avoids leaking whether the email exists.
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }
  // 3) If everything ok, send token to client
  createSendToken(user, 200, res);
});

// logout by sending a cookie with the same name but with a very short expiration time
// This will overwrite the existing JWT cookie on the client side, effectively logging the user out

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  //console.log(token);
  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401),
    );
  }
  // 2) Verify the token's signature and expiry.
  // promisify(jwt.verify) wraps the callback version so we can await it.
  // If the token is tampered with or expired, jwt.verify throws an error that
  // travels to the global error handler (handleJWTError / handleJWTExpiredError).
  // decoded looks like: { id: '64a...', iat: 1718000000, exp: 1725000000 }
  // iat = "issued at" (Unix timestamp seconds), exp = expiry timestamp.
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  //console.log(decoded);
  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401,
      ),
    );
  }
  // 4) Check if user changed password after the token was issued.
  // decoded.iat = the Unix timestamp (seconds) when the token was signed.
  // If the user changed their password AFTER this token was issued, the token is
  // effectively stale/compromised and must be rejected — forces a re-login.
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401),
    );
  }

  // All checks passed — attach the full user document to req so that downstream
  // middleware (e.g. restrictTo) and route handlers can access it as req.user.
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// isLoggedIn — used ONLY for server-rendered pages (Pug templates), NOT for API routes.
//
// Key differences from `protect`:
//  1. It NEVER throws an error — if anything goes wrong it simply calls next() silently
//     so the page still loads (just without a logged-in user). A bad/missing cookie is
//     not an error for a public page.
//  2. It uses try/catch directly instead of catchAsync because we want silent failure.
//  3. Instead of attaching the user to req.user (for API), it stores on res.locals.user
//     so Pug templates can access the user object without the route handler passing it.

exports.isLoggedIn = async (req, res, next) => {
  // 1) Getting token and check if it's there

  if (req.cookies.jwt) {
    // 2) Verify the token
    try {
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET,
      );

      // 3) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }
      // 4) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }
      // There is a logged-in user.
      // res.locals: an object that Express makes available to every Pug/view template
      // rendered during this request — no need to pass it explicitly in res.render().
      // Any variable set here (res.locals.user, res.locals.title, etc.) is directly
      // accessible as a variable inside the template.
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

// restrictTo is a MIDDLEWARE FACTORY — a function that RETURNS a middleware function.
// Why? Because Express middleware can't normally accept custom arguments.
// Solution: wrap the middleware in an outer function that captures the roles array
// via closure. The inner function is the actual middleware that Express will call.
//
// Usage in routes: router.delete('/', protect, restrictTo('admin', 'lead-guide'), ...)
// Must run AFTER protect so that req.user is already set.
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with email address.', 404));
  }
  // 2) Generate the random reset token.
  // createPasswordToken() creates a plain random token (returned to us & sent by email)
  // and also stores its SHA-256 HASH + an expiry on the user document.
  // We never store the plain token in the DB — only the hash — so if the DB is
  // compromised, the reset tokens cannot be used directly.
  const resetToken = user.createPasswordToken();

  // validateBeforeSave: false — skip all Mongoose schema validators for this save.
  // We only changed passwordResetToken & passwordResetExpires; the document still has
  // incomplete fields like passwordConfirm (which is required by the schema) but we
  // don't want validation to block saving the reset token.
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email

  try {
    const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetUrl).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    //console.error('Error sending email:', err);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500,
      ),
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token.
  // The URL contains the PLAIN token (sent to the user's email).
  // The DB stores only its SHA-256 HASH (for security, same reason as bcrypt for passwords).
  // To find the user we must hash the incoming token and compare against the stored hash.
  const hashedToken = crypto
    .createHash('sha256') // algorithm
    .update(req.params.token) // data to hash
    .digest('hex'); // output format: hexadecimal string

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    // $gt: Date.now() → MongoDB query operator "greater than".
    // This finds users where passwordResetExpires is still in the future,
    // meaning the token has not yet expired — both conditions must be true.
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  // Note: Use save() to run validators and pre-save middleware

  // 3) Update changedPasswordAt property for the user done in the userModel pre-save middleware

  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');
  // 2) Check if POSted current password is correct

  if (
    !(
      user &&
      (await user.correctPassword(req.body.passwordCurrent, user.password))
    )
  ) {
    return next(new AppError('Invalid password, please try again', 401));
  }
  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});
