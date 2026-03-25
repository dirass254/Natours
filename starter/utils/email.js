const nodeMailer = require('nodemailer');
const pug = require('pug');
const { convert } = require('html-to-text');

// it defines a class called Email that takes in a user object and a URL as parameters
// it sets the recipient email, the first name of the user, the URL and the sender email as properties of the class
module.exports = class Email {
  constructor(user, url) {
    ((this.to = user.email),
      (this.firstname = user.name.split(' ')[0]),
      (this.url = url),
      (this.from = `Cornelius <${process.env.EMAIL_FROM}>`));
  }

  // it defines a method called newTransport that creates a transporter object based on the environment (production or development)
  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      // Brevo (Sendinblue)
      return nodeMailer.createTransport({
        host: process.env.BREVO_HOST,
        port: process.env.BREVO_PORT,
        auth: {
          user: process.env.BREVO_LOGIN,
          pass: process.env.BREVO_PASSWORD,
        },
      });
    }
    //
    return nodeMailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  // Send the actual email

  async send(template, subject) {
    // 1) Render HTML based on a pug template
    const html = pug.renderFile(
      `${__dirname}/../views/emails/${template}.pug`,
      {
        firstName: this.firstname,
        url: this.url,
        subject,
      },
    );
    // 2) Define email options
    const mailOptions = {
      from: `Cornelius <${process.env.EMAIL_FROM}>`,
      to: this.to,
      subject,
      html,
      text: convert(html),
    };
    // 3) Create a transport and send email
    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('welcome', 'Welcome to the Natours Family!');
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your password reset token (valid for only 10 minutes)',
    );
  }
};
