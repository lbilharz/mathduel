import Ably from 'ably/promises'

export default async function handler(req, res) {
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
    console.error('ably-token error', e)
    res.status(500).json({ error: 'token_failed' })
  }
}
