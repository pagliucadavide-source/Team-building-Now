import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const { key, list, prefix } = req.query;
      if (list) {
        const pattern = prefix ? `${prefix}*` : "*";
        const keys = await redis.keys(pattern);
        return res.status(200).json({ keys: keys || [] });
      }
      if (!key) return res.status(400).json({ error: "key required" });
      const value = await redis.get(key);
      return res.status(200).json({ value: value ?? undefined });
    }

    if (req.method === "POST") {
      const { key, value } = req.body;
      if (!key) return res.status(400).json({ error: "key required" });
      await redis.set(key, value);
      return res.status(200).json({ key, value });
    }

    if (req.method === "DELETE") {
      const { key } = req.query;
      if (!key) return res.status(400).json({ error: "key required" });
      await redis.del(key);
      return res.status(200).json({ key, deleted: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
