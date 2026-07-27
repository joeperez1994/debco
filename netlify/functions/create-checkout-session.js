// Creates a $50 deposit AUTHORIZATION HOLD (not an immediate charge) via a Stripe
// Checkout Session with manual capture. No money moves until staff captures the
// hold later via manage-deposit.js. Zero npm dependencies — raw fetch against
// Stripe's REST API — required because this project deploys via Netlify Drop
// (no build step, no node_modules).

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Stripe is not configured on the server.' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  const { name, equipment, email, siteUrl } = payload;
  if (!name || !equipment || !siteUrl) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields: name, equipment, siteUrl.' }) };
  }

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('payment_method_types[0]', 'card');
  params.append('line_items[0][price_data][currency]', 'usd');
  params.append('line_items[0][price_data][product_data][name]', `DEBCO Rental Deposit — ${equipment}`);
  params.append('line_items[0][price_data][unit_amount]', '5000');
  params.append('line_items[0][quantity]', '1');
  params.append('payment_intent_data[capture_method]', 'manual');
  params.append('payment_intent_data[metadata][renter_name]', name);
  params.append('payment_intent_data[metadata][equipment]', equipment);
  params.append('success_url', `${siteUrl}/?deposit=success#booking`);
  params.append('cancel_url', `${siteUrl}/?deposit=cancelled#booking`);
  if (email) params.append('customer_email', email);

  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      return { statusCode: stripeRes.status, body: JSON.stringify({ error: session.error ? session.error.message : 'Stripe request failed.' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create checkout session.' }) };
  }
};
