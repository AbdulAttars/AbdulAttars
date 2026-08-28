# Abdul's Attars — Stripe setup

The website is already wired for Stripe-hosted Checkout. Complete these steps in **Test mode** before accepting real payments.

## 1. Put the files in the website repository

Copy these items into the root of the existing GitHub/Vercel project:

- `index.html`
- `api/`
- `lib/`
- `package.json`
- `package-lock.json`
- `.gitignore`

Keep the existing `assets/` folder. Do not upload `node_modules/`.

## 2. Add the first four Vercel environment variables

Open the Vercel project, then go to **Settings → Environment Variables**. Add:

1. `STRIPE_SECRET_KEY`
   - In Stripe, make sure **Test mode** is on.
   - Open **Developers/Workbench → API keys**.
   - Reveal and copy the test secret key beginning with `sk_test_`.
2. `SUPABASE_URL`
   - Use the existing Supabase project URL.
3. `SUPABASE_SERVICE_ROLE_KEY`
   - In Supabase, open **Project Settings → API/API Keys** and copy the server-side `service_role` key.
4. `SITE_URL`
   - Set this to `https://abdul-attars-inventory.vercel.app`.

Choose **Production, Preview, and Development** for the test setup, save the variables, and redeploy the project.

Important: `STRIPE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are private server secrets. Never paste them into `index.html`, commit them to GitHub, send them through DM, or share them in chat.

## 3. Create the Stripe webhook

After the first deployment succeeds:

1. In Stripe Test mode, open **Workbench/Developers → Webhooks**.
2. Choose **Create destination** or **Add endpoint**.
3. Use this endpoint URL:

   `https://abdul-attars-inventory.vercel.app/api/stripe-webhook`

4. Subscribe to these events:

   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`

5. Finish creating the endpoint and reveal its signing secret beginning with `whsec_`.
6. Return to Vercel and add it as `STRIPE_WEBHOOK_SECRET`.
7. Redeploy once more so the webhook secret is available to the function.

## 4. Test a complete order

1. Open the deployed website.
2. Add a fragrance and complete the order form.
3. Press **Pay Securely with Stripe**.
4. On Stripe Checkout, use test card number `4242 4242 4242 4242`.
5. Use any future expiration date, any three-digit security code, and any valid billing ZIP code.
6. Finish payment and confirm that the website displays **Payment Confirmed**.
7. Track the order using its `AA-...` order ID. Supabase should show:

   - Payment: `Paid via Stripe`
   - Status: `Paid / Preparing Friday`

The cart should remain intact if the customer cancels, and clear only after Stripe verifies successful payment.

## 5. Go live only after testing

When testing is successful:

1. Finish Stripe's business verification and activate live payments.
2. Switch Stripe to Live mode and copy the live secret key beginning with `sk_live_`.
3. Create a separate Live-mode webhook using the same endpoint URL and events.
4. Replace `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Vercel with the live values.
5. Redeploy and place one small real order to verify the entire flow.

Stripe handles the card form. The site never receives or stores the customer's full card number, expiration date, or security code. Stripe does not automatically register the business for sales tax or file/remit taxes; confirm the current tax setup with a qualified New York tax professional.

## 6. Enable the ABDULS5 first-purchase promotion

The checkout supports `ABDULS5`: $5 off a bottle subtotal of at least $30, with sales tax calculated after the discount and the delivery fee kept separate.

1. In Stripe **Live mode**, open **Product catalog → Coupons** and create a coupon:
   - Name: `ABDULS5 — First Purchase`
   - Type: fixed amount
   - Amount: `$5.00 USD`
   - Maximum redemptions: `50`
2. Create a customer-facing promotion code for that coupon:
   - Code: `ABDULS5`
   - Minimum order value: `$30.00 USD`
   - Do not enable Stripe's first-time restriction; the website verifies prior paid orders using the customer's email before creating Checkout.
3. Copy the promotion code object's ID beginning with `promo_` (not the customer-facing `ABDULS5` text).
4. In Vercel, add `STRIPE_WELCOME_PROMOTION_CODE_ID` with that `promo_...` value for **Production**.
5. Redeploy the website.

Customers enter `ABDULS5` on the website before going to Stripe. Promo users must enter an email in the combined contact field. The server verifies the $30 bottle minimum and checks Supabase for a prior paid order using that email. Keep the promotion code ID in Vercel rather than hardcoding it into the HTML.
