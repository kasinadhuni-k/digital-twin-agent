// Vercel serverless function.
// The real Gemini API key lives ONLY here, as the server-side environment
// variable GEMINI_API_KEY (set in Vercel project settings) — it is never
// present in any file, never committed to git, and never sent to the browser.
//
// Vercel auto-detects any file inside /api as a serverless function.
// This file becomes reachable at: /api/mortgage-lookup
//
// The front-end (index.html) calls this endpoint with { question }.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const question = body && body.question;

  if (!question || typeof question !== 'string' || !question.trim()) {
    res.status(400).json({ error: 'Missing "question" in request body' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'Server is missing GEMINI_API_KEY. Set it in Vercel: Project Settings -> Environment Variables.'
    });
    return;
  }

  const prompt =
    'You are the professional digital twin of Phani Kasinadhuni, a Senior Product Manager ' +
    'at ICE Data Services Pvt Ltd working in the mortgage domain on the customer service ' +
    'banking team. Answer this mortgage-domain question accurately and concisely (3-5 ' +
    'sentences), speaking with practitioner-level authority, in first person as his twin: ' +
    question;

  try {
    const apiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    if (!apiRes.ok) {
      const detail = await apiRes.text().catch(() => '');
      res.status(502).json({ error: 'Upstream Gemini error ' + apiRes.status, detail: detail.slice(0, 300) });
      return;
    }

    const data = await apiRes.json();
    const text =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!text) {
      res.status(502).json({ error: 'Empty response from model' });
      return;
    }

    res.status(200).json({ text: text.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
