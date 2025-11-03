
export const htmlForEmail = {
  paymentFailed : `
    <h1>Payment Failed</h1>
    <p>We were unable to process your payment for your subscription.</p>
    <p>Please update your payment method to avoid service interruption.</p>
  `,

  paymentSucceeded : `
    <h1>Payment Successful</h1>
    <p>Your payment has been processed successfully.</p>
    <p>Thank you for your continued support!</p>
  `,

  subscriptionCreated : `
    <h1>Subscription Created</h1>
    <p>Your subscription has been successfully created.</p>
    <p>You now have access to all premium features.</p>
  `,

  subscriptionDeleted : `
    <h1>Subscription Cancelled</h1>
    <p>Your subscription has been cancelled.</p>
    <p>You will have access to premium features until the end of your billing period.</p>
  `,

  subscriptionUpdated : `
    <h1>Subscription Updated</h1>
    <p>Your subscription has been successfully updated.</p>
    <p>The changes are now active in your account.</p>
  `
}
