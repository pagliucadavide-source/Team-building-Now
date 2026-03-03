export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // DEBUG: mostra tutte le variabili d'ambiente disponibili (solo nomi, non valori)
  const allEnvKeys = Object.keys(process.env);
  const redisKeys = allEnvKeys.filter(k =>
    k.includes("KV") || k.includes("REDIS") || k.includes("UPSTASH")
  );

  const REDIS_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({
      error: "Redis not configured",
      redisEnvVarsFound: redisKeys,
      totalEnvVars: allEnvKeys.length,
      hint: "Aggiungi KV_REST_API_URL e KV_REST_API_TOKEN su Vercel > Settings > Environment Variables"
    });
  }

  const redis = async (cmd) => {
    const url = `${REDIS_URL}/${cmd.map(encodeURIComponent).join("/")}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Redis HTTP ${r.status}: ${text}`);
    }
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
    return res.status(500).json({
      error: err.message,
      stack: err.stack?.split("\n").slice(0, 5),
    });
  }
}
