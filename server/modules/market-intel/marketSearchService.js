const axios = require("axios");

/**
 * Perform a web search for competitor product listings and prices
 * Supports:
 * 1. Gemini Google Search Grounding (Live real-time Google Search)
 * 2. DuckDuckGo / Direct Web Search
 * 3. Intelligent Market Synthesizer Fallback
 */

/**
 * Search DuckDuckGo for product listings
 */
async function searchWebListings(query) {
  try {
    const encoded = encodeURIComponent(query);
    // DuckDuckGo lite/html endpoint for fast, clean snippet retrieval
    const response = await axios.get(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      timeout: 8000
    });

    const html = response.data || "";
    const results = [];

    // Parse simple link and snippet blocks
    const linkRegex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    const titleRegex = /<a class="result__a"[^>]*>([\s\S]*?)<\/a>/gi;

    const titles = [];
    const snippets = [];
    const urls = [];

    let match;
    while ((match = titleRegex.exec(html)) !== null && titles.length < 10) {
      titles.push(match[1].replace(/<[^>]+>/g, "").trim());
    }
    while ((match = snippetRegex.exec(html)) !== null && snippets.length < 10) {
      snippets.push(match[1].replace(/<[^>]+>/g, "").trim());
    }
    while ((match = linkRegex.exec(html)) !== null && urls.length < 10) {
      let u = match[1];
      if (u.includes("uddg=")) {
        try {
          const raw = u.split("uddg=")[1]?.split("&")[0];
          if (raw) u = decodeURIComponent(raw);
        } catch {}
      }
      urls.push(u);
    }

    for (let i = 0; i < Math.min(titles.length, 8); i++) {
      results.push({
        title: titles[i] || "",
        snippet: snippets[i] || "",
        url: urls[i] || `https://www.google.com/search?q=${encoded}`
      });
    }

    return results;
  } catch (err) {
    console.warn("[MARKET_WEB_SEARCH_WARN]:", err.message);
    return [];
  }
}

/**
 * Execute Gemini Google Search Grounding
 */
async function searchWithGeminiGrounding({ apiKey, prompt, model = "gemini-1.5-flash" }) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: {
        temperature: 0.2
      }
    };

    const res = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 30000
    });

    const candidate = res.data?.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text || "";
    const groundingMetadata = candidate?.groundingMetadata || null;

    return {
      success: true,
      text: textPart,
      groundingMetadata
    };
  } catch (err) {
    console.warn("[GEMINI_GROUNDING_WARN]:", err.response?.data?.error?.message || err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  searchWebListings,
  searchWithGeminiGrounding
};
