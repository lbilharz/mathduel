import Ably from 'ably/promises'
import { randomUUID } from 'node:crypto'

function rnd() { return 2 + Math.floor(Math.random() * 19) } // 2..20

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  const { room } = req.body || {}
  if (!room) return res.status(400).json({ error: 'bad_request' })

  const a = rnd()
  const b = rnd()
  const roundId = randomUUID()
  const ts = new Date().toISOString()

  try {
    const rest = new Ably.Rest({ key: process.env.ABLY_API_KEY })
    const channel = rest.channels.get(`room:${room}`)
    await channel.publish('question', { roundId, a, b, ts })
    res.status(200).json({ roundId, a, b })
  } catch (e) {
    console.error('new-round error', e)
    res.status(500).json({ error: 'publish_failed' })
  }
}
