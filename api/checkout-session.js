import Stripe from "stripe";
import { requireServerConfig, safeText } from "../lib/checkout.js";

function json(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  return response.end(JSON.stringify(body));
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return json(response, 405, { error: "Method not allowed." });
  }

  try {
    requireServerConfig();
    const sessionId = safeText(request.query && request.query.session_id, 200);
    if (!/^cs_(test|live)_/.test(sessionId)) return json(response, 400, { error: "Invalid checkout session." });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";

    return json(response, 200, {
      paid,
      paymentStatus: session.payment_status,
      orderCode: session.metadata && session.metadata.order_code
        ? session.metadata.order_code
        : session.client_reference_id,
      amountTotal: Number(session.amount_total || 0) / 100,
      fulfillment: session.metadata && session.metadata.fulfillment
        ? session.metadata.fulfillment
        : ""
    });
  } catch (_) {
    return json(response, 500, { error: "Payment confirmation could not be loaded." });
  }
}
