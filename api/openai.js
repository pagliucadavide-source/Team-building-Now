// api/openai.js  — Vercel Serverless Function
// Proxy per OpenAI gpt-4o (testo + vision con immagini base64).
// Aggiungi la chiave in Vercel → Settings → Environment Variables → OPENAI_API_KEY

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY non configurata nelle variabili d'ambiente Vercel",
    });
  }

  try {
    const { model, max_tokens, system, messages } = req.body;

    // ── Converti messaggi Anthropic → OpenAI ──────────────────────────────────
    const openaiMessages = [];

    if (system) {
      openaiMessages.push({ role: "system", content: system });
    }

    for (const msg of messages || []) {
      if (typeof msg.content === "string") {
        // Testo puro — compatibile 1:1
        openaiMessages.push({ role: msg.role, content: msg.content });

      } else if (Array.isArray(msg.content)) {
        // Multimodale — converti ogni blocco
        const openaiContent = msg.content.map((block) => {
          if (block.type === "text") {
            return { type: "text", text: block.text };
          }
          // Anthropic image → OpenAI image_url
          if (block.type === "image" && block.source?.type === "base64") {
            return {
              type: "image_url",
              image_url: {
                url: `data:${block.source.media_type};base64,${block.source.data}`,
                detail: "low",
              },
            };
          }
          // Già formato OpenAI — pass-through
          if (block.type === "image_url") return block;
          return block;
        });
        openaiMessages.push({ role: msg.role, content: openaiContent });
      }
    }

    // ── Chiamata OpenAI ───────────────────────────────────────────────────────
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

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);
      return res.status(response.status).json({
        error: data.error?.message || "OpenAI API error",
        code: data.error?.code,
      });
    }

    // ── Risposta → formato Anthropic (il frontend non cambia nulla) ───────────
    const text = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({
      content: [{ type: "text", text }],
      model: data.model,
      usage: data.usage,
    });

  } catch (err) {
    console.error("OpenAI proxy exception:", err);
    return res.status(500).json({ error: err.message });
  }
}
