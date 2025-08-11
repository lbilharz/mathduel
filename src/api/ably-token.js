// /api/ably-diag.js
import Ably from 'ably'

export default async function handler(req, res) {
  const key = process.env.ABLY_API_KEY
  const report = {
    envKeySet: !!key,
    envKeyLength: key ? key.length : 0,
    envKeyLooksValid: !!key && /^[A-Za-z0-9._-]+:[A-Za-z0-9._-]+$/.test(key),
    note: 'envKeyLooksValid prüft nur das Format, nicht die Gültigkeit.'
  }

  if (!key) return res.status(500).json({ ok: false, error: 'NO_KEY', report })

  try {
    const rest = new Ably.Rest({ key })
    // Mini-Aufruf, der scheitert, wenn der Key unbrauchbar ist:
    await new Promise((resolve, reject) => {
      rest.time((err, serverTime) => (err ? reject(err) : resolve(serverTime)))
    })
    return res.status(200).json({ ok: true, report })
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e), report })
  }
}
