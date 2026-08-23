import { randomBytes } from "node:crypto";

export const SIZE_PRICES = Object.freeze({
  S: { label: "Small", cents: 800 },
  M: { label: "Medium", cents: 1500 },
  L: { label: "Large", cents: 2300 },
  XL: { label: "Extra Large", cents: 3000 }
});

export const SALES_TAX_RATE = 0.09;
export const NYC_DELIVERY_CENTS = 800;

const PRODUCT_NAMES = [
  null,
  "Isle of Rih", "Midnight Rogue", "Elegance Noir", "Tuscan Silk", "Azure Zeal",
  "Ember Spiced", "Enchanted Heart", "Gilded Sins", "Sugar Muse", "Crimson Veil",
  "Victor's Rarity", "Cobalt Crest", "Velvet Dusk", "Eden Elixirs", "Verona Grace",
  "Savage Oasis", "Triumphant Spirit", "Dreamer's Mirage", "Midnight Marquis", "Italia Sky",
  "Belle Petale", "Sweet Yara", "Mediterranea Bleu", "Blue Signature", "Parade Luxe",
  "Fever Luxe", "Blossom Luxe", "Sunlit Aura", "Petal Reverie", "True Devotee",
  "Statesman", "Spring Waltz", "Petal Mist", "Nucci Essence", "Majestic Night",
  "Roma Essence", "Vital Eros", "Indigo Reign", "Velvet Charm", "Yara Glow",
  "Eros Ember", "Crystal Aqua", "Noir Obsession", "Vanilla Prism", "Amani",
  "Desert Sandal", "Oud Majesté", "Vanilla Vein", "Twilight Veil", "Golden Flight",
  "Silent Muse", "Blossom Blaze", "Noble Muse", "Golden Whisper", "Velvet Goddess",
  "Amber Whisper", "Elixir Angelique", "Leather Mirage", "Rebel Diesel", "Legend Invictus",
  "Dagger Heart", "Premier Grace", "Daisy Muse", "Cream Ember", "Aqua Alien",
  "Libre Flame", "Shadow Villain", "Crystal Mirage", "Angel Aura", "Voyage Breeze",
  "Dior Bloom 2021", "Cherry Petal", "Bouquet Dream", "Nucci Gold", "Strong Bond",
  "Jadore Charm", "Chloé Muse", "Issey Grace", "Bloom Grace", "Imagination Drift",
  "Sandal Soul", "Angel Whisper", "Cream Amber", "Dark Villain", "Fresh Veil",
  "Café Rosewood", "Noir Essence", "Metal Mirage", "Opium Velvet", "TSL Bloom",
  "Fever Edge", "Joyful Veil", "Luna Sport", "Fancy Muse", "Baby Powder Bliss",
  "Rose Gold Luxe", "Armani SI Dream", "Paradox Twilight", "Jadore Joy", "Issey Muse",
  "Rihannas Fenty Glow", "Prada Candy Pop", "Alien Goddess Glow", "Burberry Body", "Burberry Her Grace",
  "Wild Ember", "Bamboo Whisper", "Jadore L'eau Mist", "Rose Petal Mist", "Alpine Mist",
  "Sutton Noir", "Bleecker Grove", "Empire Current", "Midtown After Dark", "Royal Cascade",
  "Blue Devotion", "Crimson Victory", "Cosmic Ember", "Milano Lumiere", "Solar Muse",
  "Iris Veil", "Rose Royale", "Golden Allure", "Paris Blush", "Midnight Burrow",
  "Flame Petale", "Gilded Bloom", "Noir Nuit", "Yara Pearl", "Yara Blush",
  "Cobalt Crown", "Golden Nectar", "Sovereign Self", "Laurent Ascent", "Noble Gent",
  "Euphoric Veil", "Pacific Titan", "Shy Devotion", "Azure Coast", "Cerulean Breeze",
  "Milano Dusk", "Dolce Fiore", "Yara Radiance"
];

export function safeText(value, maxLength = 200) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLength);
}

export function createOrderCode() {
  const time = Date.now().toString(36).toUpperCase();
  const random = randomBytes(3).toString("hex").toUpperCase();
  return `AA-${time}-${random}`;
}

export function normalizeCheckoutRequest(body) {
  if (!body || typeof body !== "object") throw new Error("Invalid checkout request.");

  const customer = body.customer && typeof body.customer === "object" ? body.customer : {};
  const fulfillment = safeText(customer.fulfillment, 40);
  if (fulfillment !== "Brooklyn Pickup" && fulfillment !== "NYC Delivery") {
    throw new Error("Please choose Brooklyn pickup or NYC delivery.");
  }

  const normalizedCustomer = {
    name: safeText(customer.name, 80),
    contact: safeText(customer.contact, 254),
    instagram: safeText(customer.instagram, 40),
    fulfillment,
    deliveryAddress: safeText(customer.deliveryAddress, 240),
    sample: safeText(customer.sample, 180),
    notes: safeText(customer.notes, 800)
  };

  if (!normalizedCustomer.name || !normalizedCustomer.contact) {
    throw new Error("Name and contact information are required.");
  }
  if (!normalizedCustomer.sample) throw new Error("Please choose your free sample.");
  if (fulfillment === "NYC Delivery" && !normalizedCustomer.deliveryAddress) {
    throw new Error("A complete NYC delivery address is required.");
  }

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    throw new Error("Your cart must contain between 1 and 50 lines.");
  }

  let unitCount = 0;
  const combined = new Map();
  for (const raw of body.items) {
    const productId = Number(raw && raw.product_id);
    const size = safeText(raw && raw.size, 3).toUpperCase();
    const quantity = Number(raw && raw.quantity);
    const name = PRODUCT_NAMES[productId];
    if (!Number.isInteger(productId) || !name) throw new Error("Your cart contains an unknown fragrance.");
    if (!SIZE_PRICES[size]) throw new Error("Your cart contains an invalid bottle size.");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error("Invalid quantity.");

    unitCount += quantity;
    if (unitCount > 150) throw new Error("Please contact us directly for orders over 150 bottles.");

    const key = `${productId}:${size}`;
    const existing = combined.get(key);
    if (existing) {
      existing.quantity += quantity;
      if (existing.quantity > 99) throw new Error("A cart line cannot exceed 99 bottles.");
    } else {
      combined.set(key, {
        product_id: productId,
        perfume: name,
        inspired_by: safeText(raw && raw.inspired_by, 160),
        size,
        size_label: SIZE_PRICES[size].label,
        quantity,
        unit_price: SIZE_PRICES[size].cents / 100,
        unit_amount: SIZE_PRICES[size].cents,
        line_total: (SIZE_PRICES[size].cents * quantity) / 100
      });
    }
  }

  const items = Array.from(combined.values());
  const subtotalCents = items.reduce((sum, item) => sum + item.unit_amount * item.quantity, 0);
  const taxCents = Math.round(subtotalCents * SALES_TAX_RATE);
  const deliveryCents = fulfillment === "NYC Delivery" ? NYC_DELIVERY_CENTS : 0;

  return {
    customer: normalizedCustomer,
    items,
    subtotalCents,
    taxCents,
    deliveryCents,
    totalCents: subtotalCents + taxCents + deliveryCents
  };
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}

export function instagramFromContact(value) {
  const contact = safeText(value, 40);
  if (!contact.startsWith("@")) return "";
  return contact;
}

export function getSiteOrigin(request) {
  const configured = safeText(process.env.SITE_URL, 300).replace(/\/$/, "");
  if (configured && /^https?:\/\//i.test(configured)) return configured;
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const protocol = request.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}`;
}

export function assertSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return;
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  if (new URL(origin).host !== host) throw new Error("Cross-origin checkout is not allowed.");
}

export function requireServerConfig({ webhook = false } = {}) {
  const required = ["STRIPE_SECRET_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  if (webhook) required.push("STRIPE_WEBHOOK_SECRET");
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing server configuration: ${missing.join(", ")}`);
}

export function supabaseServerHeaders(prefer) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    "Content-Type": "application/json",
    apikey: key,
    Authorization: `Bearer ${key}`
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

export async function savePendingOrder(orderCode, checkout) {
  const { customer, items, subtotalCents, taxCents, totalCents, deliveryCents } = checkout;
  const notes = [
    customer.fulfillment === "NYC Delivery"
      ? `Delivery address: ${customer.deliveryAddress}\nDelivery fee: $${(deliveryCents / 100).toFixed(2)}`
      : "Pickup: Brooklyn, appointment only\nDelivery fee: $0.00",
    "Preparation: Prepared every Friday",
    customer.notes ? `Customer notes: ${customer.notes}` : ""
  ].filter(Boolean).join("\n");

  const row = {
    order_code: orderCode,
    customer_name: customer.name,
    instagram: customer.instagram || instagramFromContact(customer.contact),
    contact: customer.contact,
    fulfillment: customer.fulfillment,
    notes,
    free_sample_choice: customer.sample,
    items: items.map(({ unit_amount, ...item }) => item),
    subtotal: subtotalCents / 100,
    sales_tax_9_percent: taxCents / 100,
    estimated_total: totalCents / 100,
    payment_status: "Stripe Checkout Pending",
    status: "Submitted / Stripe Payment Pending"
  };

  const response = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/orders`, {
    method: "POST",
    headers: supabaseServerHeaders("return=minimal"),
    body: JSON.stringify(row)
  });
  if (!response.ok) throw new Error(`Order save failed: ${await response.text()}`);
  return row;
}

export async function updateOrderStatus(orderCode, values) {
  if (!orderCode) return;
  const response = await fetch(
    `${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`,
    {
      method: "PATCH",
      headers: supabaseServerHeaders("return=minimal"),
      body: JSON.stringify(values)
    }
  );
  if (!response.ok) throw new Error(`Order update failed: ${await response.text()}`);
}

export async function rejectSoldOutItems(items) {
  const response = await fetch(
    `${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/inventory?select=product_name,status`,
    { headers: supabaseServerHeaders() }
  );
  if (!response.ok) return;

  const rows = await response.json();
  const soldOut = new Set(
    (Array.isArray(rows) ? rows : [])
      .filter((row) => String(row.status).toLowerCase().replace(/[\s-]+/g, "_") === "sold_out")
      .map((row) => String(row.product_name || "").trim().toLowerCase())
  );
  const unavailable = items.filter((item) => soldOut.has(item.perfume.toLowerCase())).map((item) => item.perfume);
  if (unavailable.length) throw new Error(`${unavailable.join(", ")} ${unavailable.length === 1 ? "is" : "are"} currently sold out.`);
}
