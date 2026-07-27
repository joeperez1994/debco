// Creates a standard Stripe Checkout Session (immediate capture) for the full
// remaining rental balance. Called from collect-balance.html — a staff-facing
// tool, not the main site. Deliberately does NOT subtract the $50 deposit;
// the deposit hold is resolved independently via manage-deposits.html.
// Zero npm dependencies — raw fetch against Stripe's REST API.

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

  const { amount, name, equipment, email, siteUrl } = payload;
  const amountNum = Number(amount);
  if (!amountNum || amountNum <= 0 || !equipment || !siteUrl) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid required fields: amount, equipment, siteUrl.' }) };
  }

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('payment_method_types[0]', 'card');
  params.append('line_items[0][price_data][currency]', 'usd');
  params.append('line_items[0][price_data][product_data][name]', `DEBCO Rental Balance — ${equipment}`);
  params.append('line_items[0][price_data][unit_amount]', String(Math.round(amountNum * 100)));
  params.append('line_items[0][quantity]', '1');
  if (name) params.append('payment_intent_data[metadata][renter_name]', name);
  params.append('payment_intent_data[metadata][equipment]', equipment);
  params.append('payment_intent_data[metadata][type]', 'remaining_balance');
  params.append('success_url', `${siteUrl}/collect-balance.html?paid=success`);
  params.append('cancel_url', `${siteUrl}/collect-balance.html?paid=cancelled`);
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
