import Stripe from "stripe";
import { requireServerConfig, updateOrderStatus } from "../lib/checkout.js";

export const config = {
  api: { bodyParser: false }
};

async function rawBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).end("Method not allowed");
  }

  try {
    requireServerConfig({ webhook: true });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const signature = request.headers["stripe-signature"];
    if (!signature) return response.status(400).end("Missing Stripe signature");

    const event = stripe.webhooks.constructEvent(
      await rawBody(request),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    const session = event.data.object;
    const orderCode = session.metadata && session.metadata.order_code
      ? session.metadata.order_code
      : session.client_reference_id;

    if (event.type === "checkout.session.completed") {
      const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
      await updateOrderStatus(orderCode, paid
        ? { payment_status: "Paid via Stripe", status: "Paid / Preparing Friday" }
        : { payment_status: "Stripe payment processing", status: "Submitted / Payment Processing" });
    } else if (event.type === "checkout.session.async_payment_succeeded") {
      await updateOrderStatus(orderCode, {
        payment_status: "Paid via Stripe",
        status: "Paid / Preparing Friday"
      });
    } else if (event.type === "checkout.session.async_payment_failed") {
      await updateOrderStatus(orderCode, {
        payment_status: "Stripe payment failed",
        status: "Submitted / Payment Pending"
      });
    } else if (event.type === "checkout.session.expired") {
      await updateOrderStatus(orderCode, {
        payment_status: "Stripe checkout expired — DM payment available",
        status: "Submitted / Payment Pending"
      });
    }

    return response.status(200).json({ received: true });
  } catch (_) {
    return response.status(400).end("Webhook verification failed");
  }
}
