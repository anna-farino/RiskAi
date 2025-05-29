import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY)
type SendGridMessage = {
  to: string 
  subject: string
  text?: string,
  html?: string
}
export default async function sendGrid({
  to,
  subject,
  text,
  html
}: SendGridMessage) {
  const msg = {
    from: {
      email: "no-reply@risqai.co",
      name: "RisqAi.co"
    },
    to,
    subject,
    text,
    html
  };

  try {
    await sgMail.send(msg);
    console.log("Email sent successfully", to, subject, text, html);
  } catch (error: any) {
    console.error(error.response);
    error.response?.body?.errors?.forEach((e: any) => console.log(e));
    console.error(Object.keys(error));
    throw error; 
  }
}
