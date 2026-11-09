const path = require("path");

/**
 * Universal Multi-Format Document Parser
 * Parses text from:
 * - PDF documents (via pdf-parse)
 * - Microsoft Word documents (.docx, .doc via mammoth)
 * - Excel spreadsheets & CSV files (.xlsx, .xls, .csv via xlsx)
 * - Plain text, Markdown, JSON (via utf-8 decode)
 * - Scanned documents & Images (detects and signals isVisionNeeded: true)
 */
async function parseDocument(fileBuffer, mimeType = "", filename = "") {
  if (!Buffer.isBuffer(fileBuffer)) {
    throw new Error("Invalid fileBuffer provided for document parsing");
  }

  const cleanMime = (mimeType || "").toLowerCase().split(";")[0].trim();
  const lowerName = (filename || "").toLowerCase();

  // 1. PDF Documents
  if (cleanMime.includes("pdf") || lowerName.endsWith(".pdf")) {
    try {
      const pdfParse = require("pdf-parse");
      const pdfData = await pdfParse(fileBuffer);
      if (pdfData && pdfData.text && pdfData.text.trim().length > 15) {
        return {
          text: pdfData.text.trim(),
          isVisionNeeded: false,
          format: "pdf"
        };
      }
    } catch (pdfErr) {
      console.warn("[DOCUMENT_PARSER_PDF_WARN]", pdfErr.message);
    }
    // If text was empty or minimal (e.g. scanned image PDF), signal that multimodal vision is needed
    return {
      text: "",
      isVisionNeeded: true,
      mimeType: "application/pdf",
      format: "pdf_scanned"
    };
  }

  // 2. Word Documents (.docx, .doc)
  if (
    cleanMime.includes("word") ||
    cleanMime.includes("officedocument") ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc")
  ) {
    try {
      const mammoth = require("mammoth");
      const docResult = await mammoth.extractRawText({ buffer: fileBuffer });
      if (docResult && docResult.value && docResult.value.trim().length > 5) {
        return {
          text: docResult.value.trim(),
          isVisionNeeded: false,
          format: "word"
        };
      }
    } catch (docErr) {
      console.warn("[DOCUMENT_PARSER_MAMMOTH_WARN]", docErr.message);
    }
  }

  // 3. Excel Spreadsheets (.xlsx, .xls) & CSV
  if (
    cleanMime.includes("spreadsheet") ||
    cleanMime.includes("excel") ||
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    cleanMime.includes("csv") ||
    lowerName.endsWith(".csv")
  ) {
    try {
      const XLSX = require("xlsx");
      const wb = XLSX.read(fileBuffer, { type: "buffer" });
      const sheetName = wb.SheetNames[0];
      if (sheetName) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
        if (rows.length > 0) {
          const csvText = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
          return {
            text: csvText.trim(),
            rows,
            isVisionNeeded: false,
            format: "spreadsheet"
          };
        }
      }
    } catch (xlsErr) {
      console.warn("[DOCUMENT_PARSER_XLSX_WARN]", xlsErr.message);
    }
  }

  // 4. Images (JPEG, PNG, WebP)
  if (
    cleanMime.startsWith("image/") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".webp")
  ) {
    return {
      text: "",
      isVisionNeeded: true,
      mimeType: cleanMime || "image/jpeg",
      format: "image"
    };
  }

  // 5. Plain Text, Markdown, CSV, JSON
  const rawUtf8 = fileBuffer.toString("utf8").trim();
  return {
    text: rawUtf8,
    isVisionNeeded: false,
    format: "text"
  };
}

module.exports = {
  parseDocument
};
