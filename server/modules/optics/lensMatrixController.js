const XLSX = require("xlsx");
const getProductsModel = require("../products/productModel");
const getCategoriesModel = require("../categories/categoryModel");
const getMatrixTemplateModel = require("../matrix-templates/matrixTemplateModel");
const { getAuditLogModel } = require("../audit/auditModel");
const { callUnifiedChat } = require("../../core/ai/unifiedLlm");

/**
 * List all lens products that can be managed via matrix or are optical lenses
 */
exports.listLensProducts = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const Categories = getCategoriesModel(req.subdomain);

    // Strictly find categories where hasGridSpecs is enabled
    const gridCats = await Categories.find({ hasGridSpecs: true }).lean();
    const gridCatIds = gridCats.map((c) => c._id);

    if (gridCatIds.length === 0) {
      return res.json({ done: true, products: [], categories: [] });
    }

    const query = {
      categoryId: { $in: gridCatIds }
    };

    const products = await Products.find(query)
      .populate("categoryId", "name hasGridSpecs gridConfig")
      .select("name price costPrice stockCount storeStock externalStock opticsSpecs categoryId barcode images")
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ done: true, products, categories: gridCats });
  } catch (err) {
    next(err);
  }
};

/**
 * Get matrix data, template structure, and current counts for a specific lens product
 */
exports.getLensMatrix = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const MatrixTemplate = getMatrixTemplateModel(req.subdomain);
    const product = await Products.findById(req.params.id)
      .populate("categoryId", "name matrixTemplateId hasGridSpecs gridConfig")
      .lean();

    if (!product) {
      return res.status(404).json({ error: "منتج العدسة غير موجود" });
    }

    // Determine Matrix Template (from category gridConfig or template or default optics template)
    let template = null;
    if (product.categoryId?.hasGridSpecs && product.categoryId?.gridConfig?.axisX && product.categoryId?.gridConfig?.axisY) {
      template = {
        name: product.categoryId.name,
        industry: "custom",
        axisX: product.categoryId.gridConfig.axisX,
        axisY: product.categoryId.gridConfig.axisY
      };
    } else if (product.categoryId?.matrixTemplateId) {
      template = await MatrixTemplate.findById(product.categoryId.matrixTemplateId).lean();
    }
    if (!template) {
      template = await MatrixTemplate.findOne({ isDefault: true, industry: "optics" }).lean();
    }
    if (!template) {
      template = await MatrixTemplate.findOne({ isDefault: true }).lean();
    }

    const matrixStock = product.opticsSpecs?.matrixStock || {};
    const unallocatedStock = Number(product.opticsSpecs?.unallocatedStock || 0);

    // Compute live matrix sum
    let matrixSum = 0;
    for (const val of Object.values(matrixStock)) {
      matrixSum += Number(val || 0);
    }

    res.json({
      done: true,
      product: {
        _id: product._id,
        name: product.name,
        price: product.price,
        costPrice: product.costPrice || 0,
        stockCount: product.stockCount,
        storeStock: product.storeStock,
        externalStock: product.externalStock || 0,
        unallocatedStock,
        matrixSum,
        barcode: product.barcode,
        opticsSpecs: product.opticsSpecs || {},
        category: product.categoryId
      },
      template,
      matrixStock
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update the whole matrix stock grid directly
 * Enforces rule: "رصيد الصنف يساوي مجموع مصفوفته تلقائياً"
 */
exports.updateLensMatrix = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const { matrixStock = {}, unallocatedStock = 0 } = req.body;

    const product = await Products.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "منتج العدسة غير موجود" });
    }

    // Sanitize matrix stock (keep 0 for previously stocked slots that became depleted)
    const prevMatrix = product.opticsSpecs?.matrixStock || {};
    const cleanMatrix = {};
    let totalMatrixCount = 0;
    for (const [key, val] of Object.entries(matrixStock)) {
      if (!key.includes("_")) continue;
      const num = Math.max(0, parseInt(val, 10) || 0);
      if (num > 0) {
        cleanMatrix[key] = num;
        totalMatrixCount += num;
      } else if (val === 0 || val === "0" || prevMatrix[key] !== undefined) {
        cleanMatrix[key] = 0;
      }
    }

    const cleanUnallocated = Math.max(0, parseInt(unallocatedStock, 10) || 0);
    const newStoreStock = totalMatrixCount + cleanUnallocated;

    if (!product.opticsSpecs) product.opticsSpecs = {};
    product.opticsSpecs.isMatrixManaged = true;
    product.opticsSpecs.matrixStock = cleanMatrix;
    product.opticsSpecs.unallocatedStock = cleanUnallocated;
    product.storeStock = newStoreStock;
    product.stockCount = newStoreStock + Number(product.externalStock || 0);
    product.markModified("opticsSpecs");
    product.markModified("opticsSpecs.matrixStock");

    await product.save();

    // Audit log
    const AuditLog = getAuditLogModel(req.subdomain);
    if (AuditLog) {
      await AuditLog.create({
        action: "UPDATE",
        entity: "LENS_MATRIX",
        targetId: String(product._id),
        targetCode: product.barcode || product.name,
        details: `تحديث أرصدة مصفوفة العدسات ${product.name} (الإجمالي الجديد في المحل: ${newStoreStock})`,
        metadata: { totalMatrixCount, cleanUnallocated }
      }).catch(() => {});
    }

    res.json({
      done: true,
      message: "تم حفظ وتحديث رصيد مصفوفة العدسات بنجاح",
      product: {
        _id: product._id,
        name: product.name,
        storeStock: product.storeStock,
        stockCount: product.stockCount,
        unallocatedStock: cleanUnallocated
      },
      matrixStock: cleanMatrix
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Submit Lens Matrix Stocktaking session (الجرد)
 * Compares current vs counted, logs difference & financial loss/gain, and commits
 */
exports.submitLensStocktake = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const { countedMatrix = {}, countedUnallocated = 0, reason = "جرد دوري", notes = "" } = req.body;

    const product = await Products.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "منتج العدسة غير موجود" });
    }

    const currentMatrix = product.opticsSpecs?.matrixStock || {};
    const currentUnallocated = Number(product.opticsSpecs?.unallocatedStock || 0);

    let previousTotal = Number(product.storeStock ?? product.stockCount ?? 0);
    let countedTotal = 0;
    const cleanCountedMatrix = {};

    for (const [key, val] of Object.entries(countedMatrix)) {
      const num = Math.max(0, parseInt(val, 10) || 0);
      if (num > 0) {
        cleanCountedMatrix[key] = num;
        countedTotal += num;
      }
    }

    const numUnallocated = Math.max(0, parseInt(countedUnallocated, 10) || 0);
    countedTotal += numUnallocated;

    const varianceQty = countedTotal - previousTotal; // Negative = shortage (عجز), Positive = surplus (زيادة)
    const unitCost = Number(product.costPrice || (Number(product.price || 0) * 0.5));
    const totalVarianceValue = Math.abs(varianceQty) * unitCost;

    // Apply counted figures
    product.opticsSpecs.matrixStock = cleanCountedMatrix;
    product.opticsSpecs.unallocatedStock = numUnallocated;
    product.storeStock = countedTotal;
    product.stockCount = countedTotal + Number(product.externalStock || 0);

    // If shortage, record as scrap / loss record
    if (varianceQty < 0) {
      if (!product.scrapRecords) product.scrapRecords = [];
      product.scrapRecords.push({
        quantity: Math.abs(varianceQty),
        reason: `عجز جرد مصفوفة: ${reason} ${notes ? `(${notes})` : ""}`,
        warehouse: "store",
        unitCost,
        totalLoss: totalVarianceValue,
        recordedBy: req.user?.fullname || "أمين المخزن",
        date: new Date()
      });
    }

    await product.save();

    // Audit Logging
    const AuditLog = getAuditLogModel(req.subdomain);
    if (AuditLog) {
      await AuditLog.create({
        action: "STOCKTAKE",
        entity: "LENS_MATRIX",
        targetId: String(product._id),
        targetCode: product.barcode || product.name,
        details: `اعتماد جرد مصفوفة العدسات: الرصيد السابق ${previousTotal} -> الفعلي ${countedTotal} (فارق: ${varianceQty > 0 ? `+${varianceQty} زيادة` : `${varianceQty} عجز`} بقيمة ${totalVarianceValue} ج.م) - السبب: ${reason}`,
        metadata: {
          previousTotal,
          countedTotal,
          varianceQty,
          totalVarianceValue,
          reason,
          notes,
          staff: req.user?.fullname
        }
      }).catch(() => {});
    }

    res.json({
      done: true,
      message: `تم اعتماد جرد المصفوفة بنجاح (فارق: ${varianceQty >= 0 ? `+${varianceQty}` : varianceQty} قطعة)`,
      varianceQty,
      totalVarianceValue,
      storeStock: product.storeStock,
      stockCount: product.stockCount
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Quick Power Checker & Single Cell Adjuster
 * Input SPH and CYL -> see available stock, increment or decrement
 */
exports.quickAdjustLensCell = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const { sph, cyl, action, quantity = 1 } = req.body;

    if (!sph || !cyl) {
      return res.status(400).json({ error: "يرجى تحديد قيم SPH و CYL" });
    }

    const product = await Products.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "منتج العدسة غير موجود" });
    }

    const key = `${sph}_${cyl}`;
    const matrix = product.opticsSpecs?.matrixStock || {};
    const currentCellQty = Number(matrix[key] || 0);

    if (action === "check") {
      return res.json({
        done: true,
        key,
        sph,
        cyl,
        available: currentCellQty,
        productName: product.name
      });
    }

    const changeQty = Math.max(1, parseInt(quantity, 10) || 1);
    let newCellQty = currentCellQty;

    if (action === "add" || action === "supply") {
      newCellQty += changeQty;
    } else if (action === "sub" || action === "dispense") {
      if (currentCellQty < changeQty) {
        return res.status(400).json({
          error: `الرصيد المتاح من مقاس (${sph} / ${cyl}) هو (${currentCellQty}) فقط ولا يكفي لصرف (${changeQty})`
        });
      }
      newCellQty -= changeQty;
    }

    matrix[key] = Math.max(0, newCellQty);

    // Recalculate total
    let totalMatrix = 0;
    for (const [k, val] of Object.entries(matrix)) {
      if (!k.includes("_")) continue;
      totalMatrix += Math.max(0, Number(val || 0));
    }
    const unallocated = Number(product.opticsSpecs?.unallocatedStock || 0);
    const totalStore = totalMatrix + unallocated;

    product.opticsSpecs.matrixStock = matrix;
    product.opticsSpecs.isMatrixManaged = true;
    product.storeStock = totalStore;
    product.stockCount = totalStore + Number(product.externalStock || 0);
    product.markModified("opticsSpecs");
    product.markModified("opticsSpecs.matrixStock");
    await product.save();

    res.json({
      done: true,
      message: `تم تعديل رصيد مقاس (${sph} / ${cyl}) ليصبح (${newCellQty}) حبة`,
      key,
      newCellQty,
      storeStock: product.storeStock,
      stockCount: product.stockCount
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Export Lens Matrix to real 2D Excel sheet (SPH rows x CYL cols)
 */
exports.exportLensExcel = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const MatrixTemplate = getMatrixTemplateModel(req.subdomain);

    const product = await Products.findById(req.params.id)
      .populate("categoryId", "matrixTemplateId")
      .lean();
    if (!product) {
      return res.status(404).json({ error: "منتج العدسة غير موجود" });
    }

    let template = null;
    if (product.categoryId?.matrixTemplateId) {
      template = await MatrixTemplate.findById(product.categoryId.matrixTemplateId).lean();
    }
    if (!template) {
      template = await MatrixTemplate.findOne({ isDefault: true, industry: "optics" }).lean();
    }

    const cylValues = template?.axisX?.values || ["0.00", "-0.25", "-0.50", "-0.75", "-1.00", "-1.25", "-1.50", "-1.75", "-2.00"];
    const sphValues = template?.axisY?.values || ["0.00", "-0.25", "-0.50", "-0.75", "-1.00"];
    const matrixStock = product.opticsSpecs?.matrixStock || {};

    const rows = [];
    for (const sph of sphValues) {
      const row = { "SPH \\ CYL": sph };
      for (const cyl of cylValues) {
        const key = `${sph}_${cyl}`;
        row[cyl] = matrixStock[key] || 0;
      }
      rows.push(row);
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "مصفوفة العدسات");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `Lens_Matrix_${product.name.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_")}.xlsx`;

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
};

/**
 * Import Lens Matrix from Excel
 * Reads 2D table or tabular list, extracts (SPH, CYL) -> Qty, and updates matrix
 */
exports.importLensExcel = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const product = await Products.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "منتج العدسة غير موجود" });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "يرجى إرفاق ملف إكسيل صالح" });
    }

    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    if (!data || data.length < 2) {
      return res.status(400).json({ error: "ملف الإكسيل فارغ أو لا يحتوي على صفوف بيانات" });
    }

    const newMatrix = { ...(product.opticsSpecs?.matrixStock || {}) };
    let importedCells = 0;

    // Detect if header row contains CYL values (e.g. 0.00, -0.25, -0.50...)
    const headerRow = data[0];
    const cylCols = [];
    for (let c = 1; c < headerRow.length; c++) {
      const headerVal = String(headerRow[c] ?? "").trim();
      if (headerVal !== "") {
        cylCols.push({ colIndex: c, cyl: headerVal });
      }
    }

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length === 0) continue;
      const sphVal = String(row[0] ?? "").trim();
      if (!sphVal) continue;

      for (const { colIndex, cyl } of cylCols) {
        const qtyRaw = row[colIndex];
        const qty = parseInt(qtyRaw, 10);
        if (!isNaN(qty) && qty >= 0) {
          const key = `${sphVal}_${cyl}`;
          if (qty > 0) {
            newMatrix[key] = qty;
          } else {
            delete newMatrix[key];
          }
          importedCells++;
        }
      }
    }

    // Recalculate total
    let totalMatrix = 0;
    for (const val of Object.values(newMatrix)) {
      totalMatrix += Number(val || 0);
    }
    const unallocated = Number(product.opticsSpecs?.unallocatedStock || 0);
    const newStoreTotal = totalMatrix + unallocated;

    product.opticsSpecs.matrixStock = newMatrix;
    product.opticsSpecs.isMatrixManaged = true;
    product.storeStock = newStoreTotal;
    product.stockCount = newStoreTotal + Number(product.externalStock || 0);
    await product.save();

    res.json({
      done: true,
      message: `تم استيراد ${importedCells} مقاس في مصفوفة العدسات بنجاح (الإجمالي: ${newStoreTotal} حبة)`,
      importedCells,
      storeStock: newStoreTotal
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Normalize Arabic words & spoken numbers into standard digits and tokens
 */
function normalizeArabicMatrixCommand(rawText = "") {
  return String(rawText || "")
    .trim()
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/صفر|زيرو/g, " 0 ")
    .replace(/واحد(?:ة|ه)?|حبة واحدة|قطعة واحدة/g, " 1 ")
    .replace(/حبتين|قطعتين|اثنين|إثنين|اثنان|إثنان|اتنين/g, " 2 ")
    .replace(/ثلاث(?:ة|ه)?|تلات(?:ة|ه)?/g, " 3 ")
    .replace(/أربع(?:ة|ه)?|اربع(?:ة|ه)?/g, " 4 ")
    .replace(/خمس(?:ة|ه)?/g, " 5 ")
    .replace(/ست(?:ة|ه)?/g, " 6 ")
    .replace(/سبع(?:ة|ه)?/g, " 7 ")
    .replace(/ثماني(?:ة|ه)?|تماني(?:ة|ه)?|ثمان/g, " 8 ")
    .replace(/تسع(?:ة|ه)?/g, " 9 ")
    .replace(/عشر(?:ة|ه)?/g, " 10 ")
    .replace(/سالب|ناقص/g, " -")
    .replace(/موجب|زائد/g, " +")
    .replace(/نصف|نص/g, " 0.50 ")
    .replace(/ثلاثة أرباع|تلات تربع/g, " 0.75 ")
    .replace(/ربع/g, " 0.25 ")
    .replace(/سيلندر|سلندر|استجماتيزم|إستجماتيزم/gi, " cyl ")
    .replace(/سفير|درجة|درجه/gi, " sph ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deterministic Arabic & Optical Matrix Command Parser
 * Handles:
 * - "دخل في كل الخلايا اثنين ما عدا النظارات طويلة النظر" (base=2, exclude plus)
 * - "دخل في دول اثنين ما عدا طويلة النظر أربعة" (base=2, plus=4)
 * - "قصر النظر 3 وطول النظر 1"
 * - "كل الأدراج فيها 2 ما عدا -2.00 سلندر -0.50 فيه 4"
 */
function parseDeterministicMatrixPlan(rawCommand, { allSphValues = [], visibleSphValues = [], cylValues = [] }) {
  const norm = normalizeArabicMatrixCommand(rawCommand);
  const rules = [];
  let baseQty = null;
  let baseScope = "all"; // 'all' | 'visible'

  // Split by exception keywords ("ما عدا", "عدا", "إلا", "باستثناء", "غير")
  const parts = norm.split(/\s*(?:ما\s*عدا|ماعدا|عدا|إلا|الا|باستثناء)\s*/i);
  const mainPart = parts[0] || "";
  const exceptionParts = parts.slice(1);

  // Check if mainPart specifies "دول" / "المعروض" -> visible scope, unless exception references hidden group (like طول النظر while viewing minus)
  if (/دول|المعروض|الحالي/.test(mainPart) && exceptionParts.length === 0) {
    baseScope = "visible";
  }

  // Check if mainPart sets a group directly (e.g. "طول النظر 4" or "قصر النظر 2")
  const mainHasPlusOnly = /(?:طويل(?:ة|ه)?\s*النظر|طول\s*(?:النظر)?|الموجب)/.test(mainPart) && !/(?:كل|جميع|الكل|دول|الخانات|الخلايا|الأدراج|الادراج)/.test(mainPart);
  const mainHasMinusOnly = /(?:قصير(?:ة|ه)?\s*النظر|قصر\s*(?:النظر)?|السالب)/.test(mainPart) && !/(?:كل|جميع|الكل|دول|الخانات|الخلايا|الأدراج|الادراج)/.test(mainPart);

  if (mainHasPlusOnly) {
    const m = mainPart.match(/(\d+)/);
    if (m) {
      rules.push({ type: "group", group: "plus", action: "set", qty: parseInt(m[1], 10) });
    }
  } else if (mainHasMinusOnly) {
    const m = mainPart.match(/(\d+)/);
    if (m) {
      rules.push({ type: "group", group: "minus", action: "set", qty: parseInt(m[1], 10) });
    }
  } else {
    // Extract base quantity from mainPart
    const baseMatch =
      mainPart.match(/(?:كل(?:ها)?|الكل|جميع|الأدراج|الادراج|الخانات|الخلايا|المقاسات|دول|فيهم|فيها)[^\d+-]*(\d+)/i) ||
      mainPart.match(/(?:ضع|املأ|املا|حط|اجعل|دخل|خلي|عب[يئ])[^\d+-]*(\d+)/i) ||
      mainPart.match(/^(\d+)$/);

    if (baseMatch) {
      baseQty = parseInt(baseMatch[1], 10);
    }
  }

  // Parse exception clauses
  for (const excRaw of exceptionParts) {
    // Split sub-clauses by "و" or comma when followed by a group or coordinate
    const subClauses = excRaw.split(/\s*(?:،|,|و(?=\s*(?:طويل|طول|قصير|قصر|موجب|سالب|بدون|sph|cyl|[+-]?\d)))\s*/i);
    for (const clause of subClauses) {
      const c = clause.trim();
      if (!c) continue;

      // 1. Group: Farsightedness / Plus ("طويلة النظر", "طول النظر", "الموجب")
      if (/(?:طويل(?:ة|ه)?\s*النظر|طول\s*(?:النظر)?|الموجب)/i.test(c)) {
        const numMatch = c.match(/(\d+)/);
        if (numMatch) {
          rules.push({
            type: "group",
            group: "plus",
            action: "set",
            qty: parseInt(numMatch[1], 10)
          });
        } else {
          // No number specified -> means EXCLUDE plus lenses from the base fill!
          rules.push({
            type: "group",
            group: "plus",
            action: "exclude"
          });
        }
        continue;
      }

      // 2. Group: Nearsightedness / Minus ("قصيرة النظر", "قصر النظر", "السالب")
      if (/(?:قصير(?:ة|ه)?\s*النظر|قصر\s*(?:النظر)?|السالب)/i.test(c)) {
        const numMatch = c.match(/(\d+)/);
        if (numMatch) {
          rules.push({
            type: "group",
            group: "minus",
            action: "set",
            qty: parseInt(numMatch[1], 10)
          });
        } else {
          rules.push({
            type: "group",
            group: "minus",
            action: "exclude"
          });
        }
        continue;
      }

      // 3. Group: Zero CYL ("بدون سلندر", "سلندر 0")
      if (/(?:بدون\s*cyl|cyl\s*0(?:\.00)?)/i.test(c) && !/sph/i.test(c)) {
        const withoutCyl = c.replace(/0(?:\.00)?/, "");
        const numMatch = withoutCyl.match(/(\d+)/);
        if (numMatch) {
          rules.push({ type: "col", cyl: "0.00", action: "set", qty: parseInt(numMatch[1], 10) });
        } else {
          rules.push({ type: "col", cyl: "0.00", action: "exclude" });
        }
        continue;
      }

      // 4. Specific SPH / CYL cell or row
      const sphMatch = c.match(/(?:sph)?\s*([+-]?\d+(?:\.\d+)?)/i);
      const cylMatch = c.match(/cyl\s*([+-]?\d+(?:\.\d+)?)/i);
      // Remove matched sph and cyl from string to find the target quantity
      let remainder = c;
      if (sphMatch) remainder = remainder.replace(sphMatch[0], " ");
      if (cylMatch) remainder = remainder.replace(cylMatch[0], " ");
      const qtyMatch =
        remainder.match(/(?:فيه|فيها|بها|كمية|ضع|رصيد|عدد|اجعل|خلي|تكون|يكون)?\s*(\d+)/i);

      if (sphMatch) {
        const rawSph = parseFloat(sphMatch[1]);
        const sphFormatted = rawSph > 0 ? `+${rawSph.toFixed(2)}` : rawSph === 0 ? "0.00" : rawSph.toFixed(2);
        if (cylMatch) {
          const rawCyl = parseFloat(cylMatch[1]);
          const cylFormatted = rawCyl > 0 ? `+${rawCyl.toFixed(2)}` : rawCyl === 0 ? "0.00" : rawCyl.toFixed(2);
          rules.push({
            type: "cell",
            sph: sphFormatted,
            cyl: cylFormatted,
            action: qtyMatch ? "set" : "exclude",
            qty: qtyMatch ? parseInt(qtyMatch[1], 10) : 0
          });
        } else {
          // Entire SPH row or (sph, 0.00)
          rules.push({
            type: "row",
            sph: sphFormatted,
            action: qtyMatch ? "set" : "exclude",
            qty: qtyMatch ? parseInt(qtyMatch[1], 10) : 0
          });
        }
      }
    }
  }

  return {
    understood: baseQty !== null || rules.length > 0,
    baseScope,
    baseQty,
    rules
  };
}

/**
 * POST /api/admin/lens-matrix/:id/ai-command
 * Uses Unified LLM (Configured Primary e.g. DeepSeek -> Default Fallback Gemini) + Deterministic Rule Engine
 * to interpret any Arabic voice/text matrix stock command.
 */
exports.interpretMatrixCommand = async (req, res, next) => {
  try {
    const {
      command = "",
      allSphValues = [],
      visibleSphValues = [],
      cylValues = []
    } = req.body || {};

    const cleanCommand = String(command || "").trim();
    if (!cleanCommand) {
      return res.status(400).json({ error: "يرجى كتابة أو نطق الأمر أولاً" });
    }

    // 1. Run Deterministic Parser first
    const detPlan = parseDeterministicMatrixPlan(cleanCommand, {
      allSphValues,
      visibleSphValues,
      cylValues
    });

    // 2. Also attempt Unified LLM (Primary DeepSeek -> Fallback Gemini) when command is complex or not fully matched by deterministic parser
    let aiPlan = null;
    const needsLlmAssist =
      !detPlan.understood ||
      /من\s*[+-]?\d|إلى\s*[+-]?\d|لحد|حتى|النص الأول|الربع|فوق|تحت|أكبر|أقل/i.test(cleanCommand);

    if (needsLlmAssist) {
      const systemPrompt = `أنت محلل أوامر ذكي لمصفوفة دروج العدسات والمقاسات (2D Matrix: الصفوف SPH والأعمدة CYL).
قيم الصفوف المتاحة (SPH): [${allSphValues.join(", ")}]
قيم الأعمدة المتاحة (CYL): [${cylValues.join(", ")}]

مهمتك: تحويل أمر المستخدم باللغة العربية أو العامية المصرية إلى خطة تعديل دقيقة بصيغة JSON فقط.
ملاحظات مهمة جداً في فهم كلام المستخدم:
1. "طويلة النظر" أو "طول النظر" أو "عدسات طويلة النظر" أو "الموجب" تعني جميع صفوف SPH الموجبة التي تبدأ بـ "+" (مثل +0.25 إلى +6.00).
2. "قصيرة النظر" أو "قصر النظر" أو "عدسات قصيرة النظر" أو "السالب" تعني جميع صفوف SPH السالبة التي تبدأ بـ "-" (مثل -0.25 إلى -6.00).
3. إذا قال المستخدم مثلاً: "دخل في كل الخلايا اثنين ما عدا النظارات طويلة النظر" (بدون رقم بعد ما عدا) فهذا يعني:
   baseQty: 2, والقاعدة لـ group: "plus" هي action: "exclude" (أي استثنائها وعدم تعبئتها بـ 2).
4. أما إذا قال: "دخل في دول اثنين ما عدا طويلة النظر أربعة" فهذا يعني:
   baseQty: 2, والقاعدة لـ group: "plus" هي action: "set", qty: 4 (أي وضع 4 في كل صفوف الموجب +).

أرجع JSON فقط بهذا الشكل:
{
  "baseScope": "all" | "visible",
  "baseQty": number | null,
  "rules": [
    {
      "type": "group" | "row" | "col" | "cell",
      "group": "plus" | "minus" | "zero_sph" | null,
      "sph": "+1.00" | null,
      "cyl": "-0.50" | null,
      "action": "set" | "exclude",
      "qty": number | null
    }
  ],
  "summaryAr": "ملخص قصير لما تم تنفيذه بالعربية"
}`;

      try {
        const llmRes = await callUnifiedChat({
          subdomain: req.subdomain,
          adminData: req.adminData,
          systemPrompt,
          userPrompt: cleanCommand,
          temperature: 0.1,
          jsonMode: true,
          timeout: 15000
        });
        if (llmRes?.parsed && (llmRes.parsed.baseQty !== undefined || Array.isArray(llmRes.parsed.rules))) {
          aiPlan = {
            understood: llmRes.parsed.baseQty !== null || (llmRes.parsed.rules && llmRes.parsed.rules.length > 0),
            baseScope: llmRes.parsed.baseScope || "all",
            baseQty: typeof llmRes.parsed.baseQty === "number" ? llmRes.parsed.baseQty : detPlan.baseQty,
            rules: Array.isArray(llmRes.parsed.rules) && llmRes.parsed.rules.length > 0 ? llmRes.parsed.rules : detPlan.rules,
            summaryAr: llmRes.parsed.summaryAr || "",
            provider: llmRes.provider,
            model: llmRes.model
          };
        }
      } catch (llmErr) {
        console.warn("[MATRIX_AI_CMD_FALLBACK_TO_DETERMINISTIC]:", llmErr.message);
      }
    }

    const finalPlan = aiPlan && aiPlan.understood ? aiPlan : detPlan;
    if (!finalPlan.understood) {
      return res.status(400).json({
        done: false,
        error: "تعذر استخراج مقادير واضحة من الأمر. جرب مثلاً: «دخل في كل الخلايا 2 ما عدا طويلة النظر 4» أو «كل الأدراج فيها 2 ما عدا -2.00 سلندر -0.50 فيه 4»"
      });
    }

    return res.json({
      done: true,
      plan: finalPlan,
      normalizedCommand: normalizeArabicMatrixCommand(cleanCommand)
    });
  } catch (err) {
    next(err);
  }
};
