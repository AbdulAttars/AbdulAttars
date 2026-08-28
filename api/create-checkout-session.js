import Stripe from "stripe";
import {
  SIZE_PRICES,
  assertWelcomePromotionEligible,
  assertSameOrigin,
  createOrderCode,
  getSiteOrigin,
  isEmail,
  normalizeCheckoutRequest,
  rejectSoldOutItems,
  requireServerConfig,
  savePendingOrder,
  updateOrderStatus
} from "../lib/checkout.js";

function json(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  return response.end(JSON.stringify(body));
}

function requestBody(request) {
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");
  return request.body || {};
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Method not allowed." });
  }

  let orderCode = "";
  try {
    assertSameOrigin(request);
    requireServerConfig();

    const checkout = normalizeCheckoutRequest(requestBody(request));
    await rejectSoldOutItems(checkout.items);
    let welcomePromotionCodeId = "";
    if (checkout.promoCode) {
      welcomePromotionCodeId = String(process.env.STRIPE_WELCOME_PROMOTION_CODE_ID || "").trim();
      if (!/^promo_[A-Za-z0-9]+$/.test(welcomePromotionCodeId)) {
        throw new Error("The ABDULS5 promotion is temporarily unavailable.");
      }
      await assertWelcomePromotionEligible(checkout.customer.contact);
    }
    orderCode = createOrderCode();
    await savePendingOrder(orderCode, checkout);

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const lineItems = checkout.items.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: `${item.perfume} — ${SIZE_PRICES[item.size].label}`,
          description: item.inspired_by ? `Inspired by ${item.inspired_by}` : "Halal perfume oil"
        },
        unit_amount: item.unit_amount
      },
      quantity: item.quantity
    }));

    if (checkout.taxCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Sales tax (9%)" },
          unit_amount: checkout.taxCents
        },
        quantity: 1
      });
    }

    if (checkout.deliveryCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "NYC local delivery" },
          unit_amount: checkout.deliveryCents
        },
        quantity: 1
      });
    }

    const origin = getSiteOrigin(request);
    const sessionParams = {
      mode: "payment",
      line_items: lineItems,
      client_reference_id: orderCode,
      metadata: {
        order_code: orderCode,
        fulfillment: checkout.customer.fulfillment,
        promo_code: checkout.promoCode || "",
        discount_cents: String(checkout.discountCents || 0)
      },
      payment_intent_data: {
        metadata: {
          order_code: orderCode,
          promo_code: checkout.promoCode || ""
        }
      },
      success_url: `${origin}/?stripe=success&session_id={CHECKOUT_SESSION_ID}#track-order`,
      cancel_url: `${origin}/?stripe=cancelled&order_id=${encodeURIComponent(orderCode)}#shop`,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      submit_type: "pay",
      locale: "auto"
    };

    if (checkout.promoCode) {
      sessionParams.discounts = [{
        promotion_code: welcomePromotionCodeId
      }];
    }

    if (isEmail(checkout.customer.contact)) {
      sessionParams.customer_email = checkout.customer.contact;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return json(response, 200, {
      url: session.url,
      sessionId: session.id,
      orderCode,
      subtotal: checkout.subtotalCents / 100,
      discount: checkout.discountCents / 100,
      tax: checkout.taxCents / 100,
      total: checkout.totalCents / 100
    });
  } catch (error) {
    if (orderCode) {
      try {
        await updateOrderStatus(orderCode, {
          payment_status: "Stripe checkout could not start",
          status: "Submitted / Payment Pending"
        });
      } catch (_) {}
    }

    const message = error instanceof Error ? error.message : "Checkout could not start.";
    const clientError = /required|invalid|unknown|sold out|cart|quantity|choose|address|cross-origin|promo|promotion|first purchase|minimum|email|redeem|discount/i.test(message);
    return json(response, clientError ? 400 : 500, {
      error: clientError ? message : "Secure checkout is temporarily unavailable. Please try again or use the DM option."
    });
  }
}
