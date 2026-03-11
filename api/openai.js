// api/openai.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY mancante" });
  }

  let body;
  try {
    body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Body non valido" });
    }
  } catch (e) {
    return res.status(400).json({ error: "Errore parsing body: " + e.message });
  }

  const { model, max_tokens, system, messages } = body;

  const openaiMessages = [];
  if (system) openaiMessages.push({ role: "system", content: system });

  for (const msg of messages || []) {
    if (typeof msg.content === "string") {
      openaiMessages.push({ role: msg.role, content: msg.content });
    } else if (Array.isArray(msg.content)) {
      const content = msg.content.map((block) => {
        if (block.type === "text") return { type: "text", text: block.text };
        if (block.type === "image" && block.source?.type === "base64") {
          return {
            type: "image_url",
            image_url: {
              url: `data:${block.source.media_type};base64,${block.source.data}`,
              detail: "low",
            },
          };
        }
        if (block.type === "image_url") return block;
        return block;
      });
      openaiMessages.push({ role: msg.role, content });
    }
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o",
        max_tokens: max_tokens || 1000,
        messages: openaiMessages,
        temperature: 0.7,
      }),
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      return res.status(500).json({ error: "OpenAI risposta non JSON: " + rawText.slice(0, 200) });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "OpenAI error",
        code: data.error?.code,
      });
    }

    const replyText = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({
      content: [{ type: "text", text: replyText }],
      model: data.model,
      usage: data.usage,
    });

  } catch (err) {
    return res.status(500).json({ error: "Eccezione: " + err.message });
  }
}
