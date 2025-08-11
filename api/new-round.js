import Ably from 'ably'
import { randomUUID } from 'node:crypto'

function rnd() { return 2 + Math.floor(Math.random() * 19) } // 2..20

export default async function handler(req, res) {
  console.log('handler reached', { method: req.method, body: req.body, query: req.query })

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const room = req.method === 'GET' ? req.query.room : req.body?.room
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
