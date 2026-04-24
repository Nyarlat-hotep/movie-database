export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Bypass auth in local dev — VAULT_PASSWORD stays Sensitive in Vercel
  if (process.env.VERCEL_ENV === 'development') {
    return res.status(200).json({ ok: true });
  }

  const { password } = req.body;
  const correct = process.env.VAULT_PASSWORD;

  if (!correct) {
    return res.status(500).json({ error: 'VAULT_PASSWORD not configured' });
  }

  if (password === correct) {
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: 'Incorrect password' });
}
