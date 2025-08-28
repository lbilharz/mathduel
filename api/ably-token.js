// api/ably-token.js
import Ably from "ably";

export default async function handler(req, res) {
  const key = process.env.ABLY_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "ABLY_API_KEY not set" });
  }

  try {
    const clientId = req.query.clientId || "anon";
    const rest = new Ably.Rest({ key });
    const tokenRequest = await rest.auth.createTokenRequest({ clientId });
    res.status(200).json(tokenRequest);   // 👈 wichtig: nicht in { tokenRequest }
  } catch (err) {
    console.error("Ably token error:", err);
    res.status(500).json({ error: "Ably token failed", details: err.message });
  }
}
