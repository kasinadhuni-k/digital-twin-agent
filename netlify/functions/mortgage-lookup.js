// Netlify serverless function.
// The real Gemini API key lives ONLY here, as the server-side environment
// variable GEMINI_API_KEY (set in Netlify site settings) — it is never
// present in any file, never committed to git, and never sent to the browser.
//
// The front-end (index.html) calls this function at /.netlify/functions/mortgage-lookup
// with { question }, and this function calls Google on the server's behalf.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let question;
  try {
    ({ question } = JSON.parse(event.body || '{}'));
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!question || typeof question !== 'string' || !question.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing "question" in request body' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server is missing GEMINI_API_KEY. Set it in Netlify: Site settings -> Environment variables.' })
    };
  }

  const prompt =
    'You are the professional digital twin of Phani Kasinadhuni, a Senior Product Manager ' +
    'at ICE Data Services Pvt Ltd working in the mortgage domain on the customer service ' +
    'banking team. Answer this mortgage-domain question accurately and concisely (3-5 ' +
    'sentences), speaking with practitioner-level authority, in first person as his twin: ' +
    question;

  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Upstream Gemini error ' + res.status, detail: detail.slice(0, 300) })
      };
    }

    const data = await res.json();
    const text =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!text) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Empty response from model' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
