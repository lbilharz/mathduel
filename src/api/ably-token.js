import Ably from 'ably/promises'

export default async function handler(req, res) {
  console.log('[ably-token] Incoming request', {
    method: req.method,
    headers: req.headers,
    body: req.body,
    envKeySet: !!process.env.ABLY_API_KEY,
    envKeySample: process.env.ABLY_API_KEY ? process.env.ABLY_API_KEY.slice(0, 5) + '...' : null
  })
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  const { room, clientId } = req.body || {}
  if (!room || !clientId) return res.status(400).json({ error: 'bad_request' })

  try {
    const rest = new Ably.Rest({ key: process.env.ABLY_API_KEY })
    const capability = { [`room:${room}`]: [ 'publish', 'subscribe' ] }
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId,
      capability: JSON.stringify(capability),
      ttl: 60 * 60 * 1000
    })
    res.status(200).json({ tokenRequest })
  } catch (e) {
    console.error('[ably-token] Error details:', e?.message || e)
    console.error('ably-token error', e)
    res.status(500).json({ error: 'token_failed' })
  }
}
