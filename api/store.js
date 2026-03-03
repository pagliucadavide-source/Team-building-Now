export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const REDIS_URL   = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: "Redis not configured", vars: Object.keys(process.env).filter(k => k.includes("KV") || k.includes("REDIS")) });
  }

  const redis = async (cmd) => {
    const r = await fetch(`${REDIS_URL}/${cmd.map(encodeURIComponent).join("/")}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    const d = await r.json();
    return d.result;
  };

  try {
    if (req.method === "GET") {
      const { key, list, prefix } = req.query;
      if (list) {
        const pattern = prefix ? `${prefix}*` : "*";
        const keys = await redis(["keys", pattern]);
        return res.status(200).json({ keys: keys || [] });
      }
      if (!key) return res.status(400).json({ error: "key required" });
      const value = await redis(["get", key]);
      return res.status(200).json({ value: value ?? undefined });
    }

    if (req.method === "POST") {
      const { key, value } = req.body;
      if (!key) return res.status(400).json({ error: "key required" });
      await redis(["set", key, typeof value === "string" ? value : JSON.stringify(value)]);
      return res.status(200).json({ key, value });
    }

    if (req.method === "DELETE") {
      const { key } = req.query;
      if (!key) return res.status(400).json({ error: "key required" });
      await redis(["del", key]);
      return res.status(200).json({ key, deleted: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
