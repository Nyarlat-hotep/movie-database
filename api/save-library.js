const GITHUB_API = 'https://api.github.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const library = req.body;
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const filePath = 'src/data/library.json';

  if (!token || !owner || !repo) {
    return res.status(500).json({ error: 'GitHub env vars not configured' });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'movie-vault',
    Accept: 'application/vnd.github+json',
  };

  // Get current file SHA
  const getRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`,
    { headers }
  );

  if (!getRes.ok) {
    const err = await getRes.json();
    return res.status(500).json({ error: `Could not fetch file SHA: ${err.message}` });
  }

  const current = await getRes.json();
  const sha = current.sha;
  const content = Buffer.from(JSON.stringify(library, null, 2)).toString('base64');

  const putRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: 'chore: update library.json [vercel skip]',
        content,
        sha,
      }),
    }
  );

  if (!putRes.ok) {
    const err = await putRes.json();
    return res.status(500).json({ error: err.message });
  }

  return res.status(200).json({ ok: true });
}
