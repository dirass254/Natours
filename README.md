# Natours

A full-stack tour booking application built with Node.js, Express, MongoDB, and Pug.

## Features

- Browse and book nature tours
- User authentication & authorization (JWT)
- Role-based access control (user, guide, admin)
- Tour reviews and ratings
- Secure payments via Stripe
- Interactive maps via Mapbox
- Email notifications (Brevo/Mailtrap)
- Security: rate limiting, XSS protection, NoSQL injection sanitization, HTTP headers (Helmet)

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** MongoDB, Mongoose
- **Frontend:** Pug, CSS, Axios, Parcel
- **Auth:** JWT, bcrypt
- **Payments:** Stripe
- **Maps:** Mapbox GL JS

## Getting Started

### Prerequisites

- Node.js
- MongoDB
- Mapbox, Stripe, and email accounts

### Installation

1. Clone the repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `starter/config.env` with the following variables:
   ```
   PORT=3000
   NODE_ENV=development
   DATABASE=<your_mongodb_connection_string>
   DATABASE_PASSWORD=<your_db_password>
   JWT_SECRET=<your_jwt_secret>
   JWT_EXPIRES_IN=90d
   JWT_COOKIE_EXPIRES_IN=90
   MAPBOX_TOKEN=<your_mapbox_token>
   STRIPE_SECRET_KEY=<your_stripe_secret_key>
   EMAIL_HOST=<smtp_host>
   EMAIL_PORT=<smtp_port>
   EMAIL_USERNAME=<smtp_username>
   EMAIL_PASSWORD=<smtp_password>
   ```
4. Start the development server:
   ```bash
   npm start
   ```

## Author

Cornelius Ndirangu
