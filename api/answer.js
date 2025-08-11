import Ably from 'ably'

async function getQuestionForRound(rest, room, roundId) {
  // Fetch recent history and find the matching question for roundId
  const channel = rest.channels.get(`room:${room}`)
  // Pull latest 50 messages backwards; increase if your rooms are long-lived
  const page = await channel.history({ direction: 'backwards', limit: 50 })
  const items = page.items || []
  for (const msg of items) {
    if (msg.name === 'question' && msg.data && msg.data.roundId === roundId) {
      return msg.data // { roundId, a, b, ts }
    }
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  const { room, roundId, playerId, answer } = req.body || {}
  if (!room || !roundId || !playerId || typeof answer !== 'number') {
    return res.status(400).json({ error: 'bad_request' })
  }

  const rest = new Ably.Rest({ key: process.env.ABLY_API_KEY })

  try {
    const q = await getQuestionForRound(rest, room, roundId)
    if (!q) return res.status(404).json({ error: 'round_not_found' })

    const correct = answer === (q.a * q.b)
    if (!correct) return res.status(200).json({ status: 'accepted' })

    // Winner payload
    const now = new Date()
    const timeMs = now.getTime() - new Date(q.ts).getTime()
    const data = { roundId, playerId, answer, timeMs, ts: now.toISOString() }

    // Use Ably idempotent publish (same message id) to avoid double-winner on race
    const channel = rest.channels.get(`room:${room}`)
    try {
      await channel.publish({ name: 'winner', data, id: `winner:${roundId}` })
    } catch (e) {
      // If a second publish with same id happens, Ably will reject; that's fine
      if (e && e.statusCode) {
        // swallow duplicate error
      } else {
        console.error('winner publish error', e)
      }
    }

    return res.status(200).json({ status: 'accepted' })
  } catch (e) {
    console.error('answer error', e)
    return res.status(500).json({ error: 'internal' })
  }
}
