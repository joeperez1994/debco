// Releases (cancels) or captures a specific held $50 deposit authorization.
// Used by manage-deposits.html. Zero npm dependencies — raw fetch.

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

  const { payment_intent_id, action } = payload;
  if (!payment_intent_id || (action !== 'release' && action !== 'capture')) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing payment_intent_id or invalid action (must be 'release' or 'capture')." }) };
  }

  const endpoint = action === 'release'
    ? `https://api.stripe.com/v1/payment_intents/${payment_intent_id}/cancel`
    : `https://api.stripe.com/v1/payment_intents/${payment_intent_id}/capture`;

  try {
    const stripeRes = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const data = await stripeRes.json();
    if (!stripeRes.ok) {
      return { statusCode: stripeRes.status, body: JSON.stringify({ error: data.error ? data.error.message : 'Stripe request failed.' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ success: true, status: data.status }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to update deposit.' }) };
  }
};
