const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const path = require('path');
const cookieParser = require('cookie-parser');

const tourRouter = require('./routes/tourRouter');
const userRouter = require('./routes/userRouter');
const reviewRouter = require('./routes/reviewRouter');
const viewRouter = require('./routes/viewRouter');
const bookingRouter = require('./routes/bookingRouter');

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));

const app = express();
// Set Pug as the view engine and specify the views directory
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// global middlewares
// Serving static files
app.use(express.static(path.join(__dirname, 'public')));
// Set security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          'https://api.mapbox.com',
          'https://cdnjs.cloudflare.com',
        ],
        workerSrc: ["'self'", 'blob:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.mapbox.com'],
        connectSrc: [
          "'self'",
          'https://*.mapbox.com',
          ...(process.env.NODE_ENV === 'development'
            ? ['ws://127.0.0.1:*']
            : []),
        ],
      },
    },
  }),
);

// Development logging
console.log(process.env.NODE_ENV);
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});
app.use('/api', limiter);

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  }),
);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
// For parsing application/x-www-form-urlencoded data, which is typically used for form submissions.
// //The extended: true option allows for rich objects and arrays to be encoded into the URL-encoded format, using the qs library. The limit: '10kb' option limits the size of the incoming data to 10 kilobytes to prevent denial-of-service attacks.
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
// cookie parser reading data from cookie
app.use(cookieParser());

app.use((req, res, next) => {
  req.requestedTime = new Date().toISOString();
  // console.log(req.cookies);
  // // eslint-disable-next-line no-undef
  // console.log(x); // This will cause an uncaught exception for testing purposes
  next();
});

// Routes
app.use('/', viewRouter);
app.use('/api/v1/bookings', bookingRouter);
// This will serve the API documentation at the /api-docs endpoint
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Mounting the routers
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);

// Handling unhandled routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handling middleware
app.use(globalErrorHandler);

module.exports = app;
