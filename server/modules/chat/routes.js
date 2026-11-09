/**
 * Chat module routes (public): AI shopping assistant (pure AI engine).
 */

const express = require("express");
const router = express.Router();

const { optionalAuth } = require("../auth/authMiddleware");
const aiChat = require("./aiChat");

router.post("/store-public/chat", optionalAuth, aiChat.handleChat);

module.exports = router;
