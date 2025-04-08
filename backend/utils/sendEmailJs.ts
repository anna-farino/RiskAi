import emailjs from '@emailjs/nodejs'

type Args = {
  template: string,
  templateParams: Record<string,unknown>
}
export async function sendEmailJs({ template, templateParams }: Args) {
  emailjs.init({
    publicKey: process.env.EMAILJS_PUBLIC_KEY,
  })
  await emailjs.send(
    process.env.EMAILJS_SERVICE_ID as string, 
    template, 
    templateParams,
    {
      publicKey: process.env.EMAILJS_PUBLIC_KEY as string,  
      privateKey: process.env.EMAILJS_PRIVATE_KEY as string 
    },
  );
}
