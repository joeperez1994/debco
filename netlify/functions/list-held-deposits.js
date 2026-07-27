// Lists all currently-held (uncaptured) $50 deposit authorizations via Stripe's
// Search API. Used by manage-deposits.html. Zero npm dependencies — raw fetch.

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Stripe is not configured on the server.' }) };
  }

  try {
    const query = encodeURIComponent("status:'requires_capture'");
    const stripeRes = await fetch(`https://api.stripe.com/v1/payment_intents/search?query=${query}&limit=50`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const data = await stripeRes.json();
    if (!stripeRes.ok) {
      return { statusCode: stripeRes.status, body: JSON.stringify({ error: data.error ? data.error.message : 'Stripe request failed.' }) };
    }

    const holds = (data.data || [])
      .map((pi) => ({
        id: pi.id,
        amount: pi.amount / 100,
        renter_name: (pi.metadata && pi.metadata.renter_name) || 'Unknown',
        equipment: (pi.metadata && pi.metadata.equipment) || 'Unknown',
        created: pi.created,
      }))
      .sort((a, b) => b.created - a.created);

    return { statusCode: 200, body: JSON.stringify({ holds }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to list held deposits.' }) };
  }
};
