const path = require("path");
const fs = require("fs");
const multer = require("multer");
const AWS = require("aws-sdk");
const multerS3 = require("multer-s3");
const getAdminDataModel = require("../settings/adminDataModel");

async function resolveAwsConfig(req) {
  let adminData = req?.adminData;
  if (!adminData?.AWS_API_KEY_ID) {
    try {
      const AdminData = getAdminDataModel(req?.subdomain);
      adminData = await AdminData.findOne().lean();
    } catch (e) {
      console.warn("Could not fetch adminData in upload:", e.message);
    }
  }
  adminData = adminData || {};
  const accessKeyId = (adminData.AWS_API_KEY_ID || req?.AWS_API_KEY_ID || process.env.AWS_API_KEY_ID || "").trim();
  const secretAccessKey = (adminData.AWS_API_KEY_SECRET || req?.AWS_API_KEY_SECRET || process.env.AWS_API_KEY_SECRET || "").trim();
  return { accessKeyId, secretAccessKey };
}

/**
 * Reusable helper to upload any image Buffer (e.g. from AI generation or camera) to S3 / Spaces
 * with automatic local disk fallback if S3 is not configured.
 */
exports.uploadBufferToStorage = async (buffer, mimeType = "image/png", originalName = "image.png", req = {}) => {
  const { accessKeyId, secretAccessKey } = await resolveAwsConfig(req);
  const subdomain = req?.subdomain;
  const prefix = subdomain ? `${subdomain}/store` : "store";
  const safeName = (originalName || "image.png").replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${prefix}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${safeName}`;

  if (accessKeyId && secretAccessKey) {
    try {
      const s3 = new AWS.S3({
        endpoint: new AWS.Endpoint("https://nyc3.digitaloceanspaces.com"),
        accessKeyId,
        secretAccessKey
      });

      const uploaded = await s3
        .upload({
          Bucket: "farweb",
          Key: key,
          Body: buffer,
          ACL: "public-read",
          ContentType: mimeType
        })
        .promise();

      if (uploaded?.Location) {
        return uploaded.Location.startsWith("http")
          ? uploaded.Location
          : `https://${uploaded.Location}`;
      }
    } catch (s3Err) {
      console.warn("[S3_BUFFER_UPLOAD_WARN] Falling back to local uploads directory:", s3Err.message);
    }
  }

  // Fallback to local /uploads directory
  const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "../../uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${safeName}`;
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${fileName}`;
};

exports.uploadFile = async (req, res, next) => {
  // Use memory storage with .any() to accept any field name: 'image', 'file', 'photo', etc.
  const memUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }
  });

  memUpload.any()(req, res, async (err) => {
    if (err) {
      console.warn("[UPLOAD_MULTER_ERROR]", err.message);
      return res.status(400).json({ error: `فشل معالجة الملف: ${err.message}`, details: err.message });
    }
    const file = req.file || (req.files && req.files[0]);
    if (!file) return res.status(400).json({ error: "لم يتم اختيار أي ملف للرفع" });

    try {
      const url = await exports.uploadBufferToStorage(
        file.buffer,
        file.mimetype,
        file.originalname,
        req
      );
      res.json({
        url,
        fileUrl: url,
        imageUrl: url,
        location: url,
        success: true
      });
    } catch (e) {
      console.error("[UPLOAD_CONTROLLER_ERROR]", e);
      return res.status(500).json({ error: "فشل حفظ الملف على الخادم أو التخزين السحابي", details: e.message });
    }
  });
};
