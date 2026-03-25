import axios from 'axios';
import { showAlert } from './alert';

export const bookTour = async (tourId) => {
  try {
    // 1. Get checkout session from API
    // this get all the information from checkout session that we created in the bookingController.
    const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);

    // 2. Redirect to Stripe checkout URL
    // we get session url from the data property of the response object and then we redirect the user to that url to complete the payment process.

    window.location.assign(session.data.session.url);
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};
