import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

type SendGridMessage = {
  to: string 
  subject: string
  text?: string,
  html?: string
}
export default function sendGrid({ 
  to, 
  subject, 
  text,
  html
} : SendGridMessage
) {
  const msg = {
    from: {
      email: "no-reply@risqai.co",
      name: "RisqAi.co"
    },
    to,
    subject,
    text,
    html
    // This is for when we start using SendGrid templates... 📝
    //templateId: "d-36ef672bbb694fb3afee39e767b8daf4",
    //dynamic_template_data: {
    //  subject,
    //  body
    //}
  }
  sgMail
    .send(msg)
    .then(() => {
      console.log("Email sent successfully", to, subject, text, html);
    })
    .catch((error) => {
      console.error(error.response)
      error.response.body.errors.forEach((e: any) => console.log(e))
      console.error(Object.keys(error))
    })
}

