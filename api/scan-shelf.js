export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageBase64 } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
            { text: 'This is a photo of a shelf of physical media (DVDs, Blu-rays, VHS tapes) at a thrift store. List every movie and TV show title you can see, one per line. Only include titles — no actor names, studio names, or other text. Include partially visible titles if readable.' }
          ]
        }]
      })
    }
  );

  const data = await response.json();
  if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Gemini API error' });

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const titles = raw
    .split('\n')
    .map(l => l.replace(/^[\d\.\-\*\)\s]+/, '').trim())
    .filter(Boolean);

  return res.status(200).json({ titles });
}
