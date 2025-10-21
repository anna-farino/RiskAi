import { stripe } from 'backend/utils/stripe-config';
import { Request, Response } from 'express'


export default async function handleSessionStatus(req: Request, res: Response) {
  const session = await stripe
    .checkout
    .sessions
    .retrieve((req as any).query.session_id, {expand: ["payment_intent"]});

   res.send({
    status: session.status,
    payment_status: session.payment_status,
    payment_intent_id: (session.payment_intent as any).id,
    payment_intent_status: (session.payment_intent as any).status
  });
}
