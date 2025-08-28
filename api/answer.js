import Ably from 'ably'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  const { room, playerId } = req.body || {}

  if (!room || !playerId) {
    return res.status(400).json({ error: 'bad_request' })
  }

  const result = { ...req.body, ts: new Date().toISOString() }

  const rest = new Ably.Rest({ key: process.env.ABLY_API_KEY })
  const channel = rest.channels.get(`room:${room}`)

  try {
    await channel.publish({ name: 'result', data: result })
  } catch (e) {
    console.error('result publish error', e)
  }

  return res.status(200).json(result)
}
