import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

type SendGridMessage = {
  to: string 
  from: string
  subject: string
  text: string
  html: string 
}
export default function sendGrid(msg: SendGridMessage) {
  sgMail
    .send(msg)
    .then((response) => {
      console.log(response[0].statusCode)
      console.log(response[0].headers);
    })
    .catch((error) => {
      console.error(error.response)
      error.response.body.errors.forEach(e => console.log(e))
      console.error(Object.keys(error))
    })
}

