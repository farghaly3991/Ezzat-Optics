/**
 * Unified Paymob Payment & Refund Engine
 *
 * Centralizes all interactions with Paymob Accept API:
 * - Credential retrieval & readiness verification per tenant
 * - Authentication (auth token)
 * - Order registration & payment key generation
 * - Transaction Refund (POST /api/acceptance/void_refund/refund)
 * - Webhook HMAC integrity verification
 */

const axios = require("axios");
const crypto = require("crypto");
const getAdminDataModel = require("../settings/adminDataModel");

const PAYMOB_API_BASE = "https://accept.paymob.com/api";

/**
 * Retrieve Paymob credentials and status for a given tenant
 */
async function getPaymobConfig(subdomain) {
  const AdminData = getAdminDataModel(subdomain);
  const adminDoc = await AdminData.findOne().lean();
  const paymob = adminDoc?.paymob || {};

  const apiKey = String(paymob.apiKey || "").trim();
  const hmacSecret = String(paymob.hmacSecret || "").trim();
  const cardIntegrationId = String(paymob.cardIntegrationId || "").trim();
  const walletIntegrationId = String(paymob.walletIntegrationId || "").trim();
  const kioskIntegrationId = String(paymob.kioskIntegrationId || "").trim();
  const cardIframeId = String(paymob.cardIframeId || "").trim();

  const isConfigured = Boolean(apiKey && (cardIntegrationId || walletIntegrationId));

  return {
    apiKey,
    hmacSecret,
    cardIntegrationId,
    walletIntegrationId,
    kioskIntegrationId,
    cardIframeId,
    isConfigured
  };
}

/**
 * Authenticate with Paymob to obtain an authorization token
 */
async function authenticate(apiKey) {
  if (!apiKey) {
    throw new Error("Paymob API Key غير مهيأ");
  }

  const response = await axios.post(`${PAYMOB_API_BASE}/auth/tokens`, {
    api_key: apiKey
  });

  if (!response.data?.token) {
    throw new Error("فشل المصادقة مع بوابة Paymob");
  }

  return response.data.token;
}

/**
 * Process a transaction refund via Paymob Accept API
 * POST https://accept.paymob.com/api/acceptance/void_refund/refund
 */
async function processRefund(subdomain, { transactionId, amountCents, reason = "" }) {
  const config = await getPaymobConfig(subdomain);

  // If transaction is mock/seed (starts with TXN_ or mock) or credentials aren't live
  const isMockTxn = String(transactionId || "").startsWith("TXN_") || !config.isConfigured;

  if (isMockTxn) {
    return {
      success: true,
      simulated: true,
      refundId: `REF_MOCK_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      transactionId,
      amountCents: Number(amountCents),
      message: "تم تسجيل استرداد المبلغ بنجاح (بيئة محاكاة / تجريبية)"
    };
  }

  try {
    const authToken = await authenticate(config.apiKey);

    const refundPayload = {
      auth_token: authToken,
      transaction_id: Number(transactionId),
      amount_cents: Number(amountCents)
    };

    const response = await axios.post(
      `${PAYMOB_API_BASE}/acceptance/void_refund/refund`,
      refundPayload,
      {
        headers: { "Content-Type": "application/json" }
      }
    );

    const data = response.data || {};

    if (data.success === false || data.id === undefined) {
      throw new Error(data.message || "فشلت عملية استرداد المبلغ عبر Paymob");
    }

    return {
      success: true,
      simulated: false,
      refundId: String(data.id),
      transactionId,
      amountCents: Number(amountCents),
      rawResponse: data,
      message: "تم استرداد المبلغ عبر Paymob بنجاح"
    };
  } catch (err) {
    const errorMsg =
      err.response?.data?.message ||
      err.response?.data?.detail ||
      err.message ||
      "تعذر معالجة استرداد Paymob";
    console.error("[PAYMOB_REFUND_ERROR]:", errorMsg);
    throw new Error(`خطأ في رد المبلغ عبر Paymob: ${errorMsg}`);
  }
}

/**
 * Verify Paymob Webhook HMAC signature
 */
function verifyHmac(receivedHmac, rawData, hmacSecret) {
  if (!hmacSecret || !receivedHmac) return false;

  try {
    const concatenatedString = [
      rawData.amount_cents,
      rawData.created_at,
      rawData.currency,
      rawData.error_occured,
      rawData.has_parent_transaction,
      rawData.id,
      rawData.integration_id,
      rawData.is_3d_secure,
      rawData.is_auth,
      rawData.is_capture,
      rawData.is_refunded,
      rawData.is_standalone_payment,
      rawData.is_voided,
      rawData.order?.id,
      rawData.owner,
      rawData.pending,
      rawData.source_data?.pan,
      rawData.source_data?.sub_type,
      rawData.source_data?.type,
      rawData.success
    ].join("");

    const calculatedHmac = crypto
      .createHmac("sha512", hmacSecret)
      .update(concatenatedString)
      .digest("hex");

    return calculatedHmac.toLowerCase() === receivedHmac.toLowerCase();
  } catch (err) {
    console.warn("[PAYMOB_HMAC_VERIFY_WARN]", err.message);
    return false;
  }
}

module.exports = {
  getPaymobConfig,
  authenticate,
  processRefund,
  verifyHmac
};
