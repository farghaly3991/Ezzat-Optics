const express = require("express");
const router = express.Router();
const { chatWithCopilot, resolveAiConfig } = require("./copilotEngine");
const { TOOL_DEFINITIONS } = require("./copilotTools");

/**
 * POST /api/admin/copilot/chat
 * Interactive ReAct Agent Loop Endpoint for Admin Dashboard
 */
router.post("/admin/copilot/chat", async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const user = req.user;
    const { message, history, confirmedAction } = req.body || {};

    if (!confirmedAction && (!message || typeof message !== "string" || !message.trim())) {
      return res.status(400).json({ error: "يرجى كتابة نص الرسالة أو الأمر المطلوب" });
    }

    const result = await chatWithCopilot({
      subdomain,
      user,
      message: message ? message.trim() : "",
      history: Array.isArray(history) ? history : [],
      confirmedAction: confirmedAction || null
    });

    res.json({
      done: true,
      reply: result.reply,
      traces: result.traces || [],
      turns: result.turns || 1,
      requiresConfirmation: Boolean(result.requiresConfirmation),
      pendingAction: result.pendingAction || null,
      clarification: result.clarification || null,
      confirmed: Boolean(result.confirmed)
    });
  } catch (err) {
    console.error("[COPILOT_ROUTE_ERR]:", err);
    res.status(500).json({
      done: false,
      error: err.message || "حدث خطأ أثناء معالجة طلب المساعد الذكي"
    });
  }
});

/**
 * GET /api/admin/copilot/tools
 * Returns active registered tool primitives and their schema
 */
router.get("/admin/copilot/tools", (req, res) => {
  res.json({
    done: true,
    count: TOOL_DEFINITIONS.length,
    tools: TOOL_DEFINITIONS.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters
    }))
  });
});

/**
 * GET /api/admin/copilot/status
 * Check AI engine connectivity and key configuration
 */
router.get("/admin/copilot/status", async (req, res) => {
  try {
    const config = await resolveAiConfig(req.subdomain);
    res.json({
      done: true,
      hasDeepSeek: Boolean(config.deepseekKey),
      hasGemini: Boolean(config.geminiKey),
      deepseekModel: config.deepseekModel,
      activeProvider: config.deepseekKey ? "deepseek" : (config.geminiKey ? "gemini" : "deterministic-fallback")
    });
  } catch (err) {
    res.status(500).json({ done: false, error: err.message });
  }
});

module.exports = router;
