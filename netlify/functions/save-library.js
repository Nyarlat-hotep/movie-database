const GITHUB_API = 'https://api.github.com';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let library;
  try {
    library = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const filePath = 'src/data/library.json';

  if (!token || !owner || !repo) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GitHub env vars not configured' }) };
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
    return { statusCode: 500, body: JSON.stringify({ error: `Could not fetch file SHA: ${err.message}` }) };
  }

  const current = await getRes.json();
  const sha = current.sha;

  // Encode updated library as base64
  const content = Buffer.from(JSON.stringify(library, null, 2)).toString('base64');

  // Commit updated file
  const putRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: 'chore: update library.json',
        content,
        sha,
      }),
    }
  );

  if (!putRes.ok) {
    const err = await putRes.json();
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
