const XLSX = require("xlsx");
const getProductsModel = require("../products/productModel");
const getCategoriesModel = require("../categories/categoryModel");

// 1. تنزيل قالب الإكسيل المخصص للبصريات
exports.getTemplate = async (req, res, next) => {
  try {
    const sampleData = [
      {
        "اسم الصنف": "شمبر رايبان أفياتور كلاسيك - ذهبي",
        "القسم": "النظارات والشنابر (Frames & Eyewear)",
        "الماركة": "Ray-Ban",
        "الموديل": "RB3025",
        "اللون": "ذهبي",
        "المقاس": "58-14-135",
        "الشكل": "أفياتور",
        "سعر البيع": 2450,
        "سعر الشراء": 1600,
        "الكمية": 15,
        "مخزن المحل": 11,
        "المخزن الخارجي": 4,
        "الباركود": "RB-3025-GOLD-58",
        "الوصف": "إطار رايبان أفياتور الأيقوني الأصلي متين ومريح"
      },
      {
        "اسم الصنف": "زوج عدسات بلو كت حماية شاشات 1.56",
        "القسم": "العدسات الطبية واللاصقة (Optical & Contact Lenses)",
        "الماركة": "BlueShield",
        "الموديل": "BC-156",
        "اللون": "شفاف عاكس أزرق",
        "المقاس": "1.56",
        "الشكل": "طبية",
        "سعر البيع": 650,
        "سعر الشراء": 320,
        "الكمية": 30,
        "مخزن المحل": 20,
        "المخزن الخارجي": 10,
        "الباركود": "LENS-BC-156-STD",
        "الوصف": "عدسات مضغوطة مانعة لانعكاس الشاشات وحماية UV420"
      },
      {
        "اسم الصنف": "محلول تعقيم العدسات اللاصقة رينو بلس 360 مل",
        "القسم": "إكسسوارات ومستلزمات البصريات (Accessories)",
        "الماركة": "Bausch + Lomb",
        "الموديل": "ReNu-360",
        "اللون": "شفاف",
        "المقاس": "360ml",
        "الشكل": "عبوة",
        "سعر البيع": 220,
        "سعر الشراء": 140,
        "الكمية": 25,
        "مخزن المحل": 18,
        "المخزن الخارجي": 7,
        "الباركود": "ACC-RENU-360ML",
        "الوصف": "محلول منظف ومرطب ومطهر لجميع العدسات اللينة"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "قالب أصناف البصريات");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", 'attachment; filename="optics_products_template.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
};

// مساعدة للتعرف الذكي على معنى أي عمود في ملف الإكسيل
function findColumnValue(row, possibleKeys) {
  const rowKeys = Object.keys(row);
  for (const candidate of possibleKeys) {
    const match = rowKeys.find(
      (k) => k.trim().toLowerCase() === candidate.toLowerCase() || k.trim().includes(candidate)
    );
    if (match !== undefined && row[match] !== undefined && row[match] !== null && String(row[match]).trim() !== "") {
      return row[match];
    }
  }
  return null;
}

// تخمين فئة ونوع الصنف من اسمه
function guessCategoryAndType(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("شنبر") || n.includes("نظار") || n.includes("اطار") || n.includes("إطار") || n.includes("frame") || n.includes("ray-ban") || n.includes("lacoste") || n.includes("gucci")) {
    return { catName: "النظارات والشنابر (Frames & Eyewear)", productType: "frame" };
  }
  if (n.includes("عدس") || n.includes("بلو كت") || n.includes("كريزال") || n.includes("فوتو") || n.includes("بروجريسيف") || n.includes("lens") || n.includes("lenses")) {
    return { catName: "العدسات الطبية واللاصقة (Optical & Contact Lenses)", productType: "lens" };
  }
  if (n.includes("محلول") || n.includes("حافظ") || n.includes("جراب") || n.includes("بخاخ") || n.includes("منديل") || n.includes("فوط") || n.includes("سلسلة") || n.includes("case") || n.includes("solution")) {
    return { catName: "إكسسوارات ومستلزمات البصريات (Accessories)", productType: "accessory" };
  }
  return { catName: "النظارات والشنابر (Frames & Eyewear)", productType: "frame" };
}

// 2. استيراد المنتجات من ملف إكسيل ذكي (لا يطلب قالباً محدداً ولا ترتيب أعمدة)
exports.importExcel = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "يرجى رفع ملف إكسيل (.xlsx)" });
    }

    const Products = getProductsModel(req.subdomain);
    const Categories = getCategoriesModel(req.subdomain);

    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: "ملف الإكسيل فارغ أو لا يحتوي على صفوف بيانات صالحة" });
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const row of rows) {
      // 1. التعرف على اسم الصنف
      const name = String(
        findColumnValue(row, ["اسم الصنف", "اسم المنتج", "الاسم", "الصنف", "name", "title", "item", "product", "description"]) || ""
      ).trim();
      if (!name) continue;

      // 2. السعر والتكلفة
      const rawPrice = findColumnValue(row, ["سعر البيع", "السعر", "قطاعي", "price", "selling price", "rate"]);
      const price = Number(rawPrice || 0);

      const rawCost = findColumnValue(row, ["سعر الشراء", "سعر التكلفة", "التكلفة", "جملة", "cost", "cost price", "purchase price"]);
      const costPrice = Number(rawCost || 0);

      // 3. الكميات ومخزن المحل والمخزن الخارجي
      const rawStock = findColumnValue(row, ["الكمية", "الرصيد", "العدد", "المخزون", "stock", "quantity", "qty", "count"]);
      const stockCount = Number(rawStock || 0);

      const rawStoreStock = findColumnValue(row, ["مخزن المحل", "المحل", "store stock", "storeStock"]);
      const rawExtStock = findColumnValue(row, ["المخزن الخارجي", "الخارجي", "external stock", "externalStock"]);

      let storeStock = rawStoreStock !== null ? Number(rawStoreStock) : Math.ceil(stockCount * 0.7);
      let externalStock = rawExtStock !== null ? Number(rawExtStock) : Math.max(0, stockCount - storeStock);

      // 4. الباركود — وتوليد باركود تلقائي لو كان فارغاً
      let barcode = String(
        findColumnValue(row, ["الباركود", "باركود", "كود الصنف", "الكود", "barcode", "code", "sku", "upc"]) || ""
      ).trim();
      if (!barcode) {
        barcode = `OPT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      }

      // 5. القسم ونوع الصنف وتخمينه الذكي
      const specifiedCat = findColumnValue(row, ["القسم", "الفئة", "التصنيف", "category", "type"]);
      let catName = specifiedCat ? String(specifiedCat).trim() : null;
      let productType = "frame";

      if (!catName) {
        const guessed = guessCategoryAndType(name);
        catName = guessed.catName;
        productType = guessed.productType;
      }

      let category = await Categories.findOne({ name: { $regex: new RegExp(catName, "i") } });
      if (!category) {
        category = await new Categories({
          name: catName,
          slug: catName.toLowerCase().replace(/[\s&()]+/g, "-"),
          active: true
        }).save();
      }

      // 6. المواصفات البصرية (الماركة، الموديل، اللون، المقاس، الشكل)
      const brand = String(findColumnValue(row, ["الماركة", "البراند", "brand", "make"]) || "").trim();
      const modelCode = String(findColumnValue(row, ["الموديل", "كود الموديل", "model", "modelcode"]) || "").trim();
      const color = String(findColumnValue(row, ["اللون", "color", "colour"]) || "").trim();
      const size = String(findColumnValue(row, ["المقاس", "الحجم", "size", "dimension"]) || "").trim();
      const shape = String(findColumnValue(row, ["الشكل", "shape", "style"]) || "").trim();
      const frameStyle = String(findColumnValue(row, ["نوع الإطار", "frameStyle", "rim"]) || "full_rim").trim();
      const lensIndex = String(findColumnValue(row, ["معامل الانكسار", "lensIndex", "index"]) || "1.56").trim();

      const specs = {
        ...(brand && { "الماركة": brand }),
        ...(modelCode && { "الموديل": modelCode }),
        ...(color && { "اللون": color }),
        ...(size && { "المقاس": size }),
        ...(shape && { "شكل الإطار": shape }),
        ...(lensIndex && { "معامل الانكسار": lensIndex })
      };

      const opticsSpecs = {
        brand,
        modelCode,
        color,
        size,
        frameShape: shape,
        frameStyle,
        lensIndex
      };

      const description = String(findColumnValue(row, ["الوصف", "description", "details", "ملاحظات"]) || "").trim();

      // البحث عن صنف مطابق بالاسم أو الباركود
      const existing = await Products.findOne({
        $or: [{ barcode }, { name, categoryId: category._id }]
      });

      if (existing) {
        existing.price = price || existing.price;
        existing.costPrice = costPrice || existing.costPrice;
        existing.stockCount = stockCount;
        existing.storeStock = storeStock;
        existing.externalStock = externalStock;
        if (barcode) existing.barcode = barcode;
        if (description) existing.description = description;
        if (Object.keys(specs).length > 0) existing.specs = { ...existing.specs, ...specs };
        if (Object.keys(opticsSpecs).length > 0) existing.opticsSpecs = { ...existing.opticsSpecs, ...opticsSpecs };
        await existing.save();
        updatedCount++;
      } else {
        await new Products({
          name,
          categoryId: category._id,
          barcode,
          price,
          costPrice,
          stockCount,
          storeStock,
          externalStock,
          description,
          productType,
          specs,
          opticsSpecs,
          images: ['https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800&auto=format&fit=crop&q=80'],
          active: true
        }).save();
        createdCount++;
      }
    }

    res.json({
      done: true,
      message: `تم الاستيراد الذكي بنجاح: إضافة ${createdCount} صنف جديد، وتحديث ${updatedCount} صنف مسجل مسبقاً مع توليد الباركود وتوزيع المخازن تلقائياً`,
      createdCount,
      updatedCount
    });
  } catch (err) {
    next(err);
  }
};

// 3. تصدير الكتالوج الحالي
exports.exportExcel = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const products = await Products.find({ active: true }).populate("categoryId").lean();

    const exportRows = products.map((p) => ({
      "اسم الصنف": p.name,
      "القسم": p.categoryId?.name || "عام",
      "الباركود": p.barcode || "",
      "سعر البيع": p.price || 0,
      "سعر الشراء": p.costPrice || 0,
      "إجمالي الرصيد": p.stockCount || 0,
      "مخزن المحل": p.storeStock ?? p.stockCount,
      "المخزن الخارجي": p.externalStock ?? 0,
      "الماركة": p.opticsSpecs?.brand || p.specs?.["الماركة"] || "",
      "المقاس": p.opticsSpecs?.size || p.specs?.["المقاس"] || "",
      "اللون": p.opticsSpecs?.color || p.specs?.["اللون"] || "",
      "الوصف": p.description || ""
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الكتالوج الحالي");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", 'attachment; filename="optics_catalog_export.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
};
