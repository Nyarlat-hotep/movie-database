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
            { text: 'This is a photo of a shelf of physical media (DVDs, Blu-rays, VHS tapes). Your task: output ONLY a plain list of movie and TV show titles, one per line. Rules: (1) No intro sentence, no header, no commentary — start directly with the first title. (2) No bullet points, numbers, dashes, or any prefix characters. (3) Only titles — no actor names, director names, studio logos, or rating labels. (4) Only include titles you can read completely and confidently — skip any title that is obscured, cut off at the edge, partially hidden, or unclear. (5) Do not group or categorize. Just one title per line, nothing else.' }
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
    .filter(l => {
      if (!l || l.length < 2) return false;       // too short
      if (l.endsWith(':')) return false;           // intro sentence
      if (l.length > 100) return false;            // too long to be a title
      if (/\.{2,}$/.test(l)) return false;         // ends with ellipsis (truncated)
      if (/\.\.\.$/.test(l)) return false;         // explicit ellipsis
      if (/[—–]\s*$/.test(l)) return false;        // ends with dash (cut off)
      if (/^\w{1,3}$/.test(l)) return false;       // single short word fragment
      return true;
    });

  return res.status(200).json({ titles });
}
