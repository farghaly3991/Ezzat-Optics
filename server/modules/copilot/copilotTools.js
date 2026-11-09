/**
 * Copilot Lego Tool Registry
 * High-performance, CQRS Layered Tool Primitives for Admin AI Executive Copilot.
 * 
 * - Read Primitives: Atomic, projection-compact queries that can be freely composed.
 * - Write Primitives: Transactionally safe, audited business mutations.
 */

const mongoose = require("mongoose");
const getOrdersModel = require("../orders/orderModel");
const getProductsModel = require("../products/productModel");
const getUsersModel = require("../auth/userModel");
const getReturnRequestModel = require("../returns/returnModel");
const { getAuditLogModel } = require("../audit/auditModel");
const getBranchModel = require("../branches/branchModel");
const { getLabModel, getWorkOrderModel } = require("../labs");
const expensesService = require("../finance/expenses/expensesService");
const partnerService = require("../finance/partners/partnerService");
const ordersController = require("../orders/ordersController");
const getSupplierModel = require("../finance/procurement/supplierModel");
const procurementReorderService = require("../finance/procurement/procurementReorderService");
const supplyWaterfallService = require("../finance/procurement/supplyWaterfallService");
const { buildWhatsAppDirectLink } = require("../product-requests/notificationService");
const { withTransaction } = require("../../core/transactionHelper");

/**
 * Helper: Ensure default optics suppliers exist and products are linked to them
 * so supply waterfall requests and purchase orders work seamlessly.
 */
async function ensureDefaultSuppliersAndLinks(subdomain) {
  const Supplier = getSupplierModel(subdomain);
  const Products = getProductsModel(subdomain);

  let suppliers = await Supplier.find({ active: { $ne: false } }).sort({ createdAt: 1 }).lean();

  if (suppliers.length === 0) {
    const created = await Supplier.insertMany([
      {
        supplierCode: "SUP-NOOR-01",
        name: "شركة النور للبصريات والعدسات العالمية",
        contactPerson: "أ/ محمود النور",
        phone: "01012345678",
        whatsappPhone: "201012345678",
        email: "orders@alnoor-optics.com",
        specialty: "عدسات طبية وبلوكت وفوتوكروميك وعدسات لاصقة ومحاليل",
        address: "باب اللوق - وسط البلد، القاهرة",
        active: true
      },
      {
        supplierCode: "SUP-AHRAM-02",
        name: "مؤسسة الأهرام للشنابر والإطارات الطبية",
        contactPerson: "أ/ شريف الأهرام",
        phone: "01098765432",
        whatsappPhone: "201098765432",
        email: "supply@ahram-frames.com",
        specialty: "إطارات وشنابر طبية وشمسية رايبان وأوكلي وغوتشي",
        address: "مصر الجديدة، القاهرة",
        active: true
      }
    ]);
    suppliers = created.map((s) => (s.toObject ? s.toObject() : s));
  }

  // Sort suppliers so those with phone/whatsapp come first, and identify specialized suppliers
  suppliers.sort((a, b) => {
    const aHasPhone = Boolean(a.phone || a.whatsappPhone) ? 0 : 1;
    const bHasPhone = Boolean(b.phone || b.whatsappPhone) ? 0 : 1;
    return aHasPhone - bHasPhone;
  });

  const lensSupplier =
    suppliers.find((s) => /essilor|hoya|نور|عدسات طبية|بصريات وتجهيز/i.test(`${s.name} ${s.supplierCode} ${s.notes || ""} ${s.specialty || ""}`) && (s.phone || s.whatsappPhone)) ||
    suppliers[0];

  const contactLensSupplier =
    suppliers.find((s) => /bausch|لاصقة|محاليل|فريش/i.test(`${s.name} ${s.supplierCode} ${s.notes || ""} ${s.specialty || ""}`) && (s.phone || s.whatsappPhone)) ||
    lensSupplier;

  const frameSupplier =
    suppliers.find((s) => /luxottica|لوكسوتيكا|أهرام|شنابر|إطارات/i.test(`${s.name} ${s.supplierCode} ${s.notes || ""} ${s.specialty || ""}`) && (s.phone || s.whatsappPhone)) ||
    suppliers[1] ||
    suppliers[0];

  // Ensure all products are accurately linked to their specialized supplier
  const allProducts = await Products.find({ active: true })
    .select("_id name productType costPrice price supplierId suppliers")
    .lean();

  if (allProducts.length > 0 && suppliers.length > 0) {
    const bulkOps = [];
    for (const p of allProducts) {
      const isFrame = p.productType === "frame" || p.productType === "sunglass";
      const isContactOrAcc = p.productType === "contact_lens" || p.productType === "accessory" || /لاصقة|فريش لوك|محلول/i.test(p.name || "");
      const primary = isFrame ? frameSupplier : isContactOrAcc ? contactLensSupplier : lensSupplier;
      const secondary = isFrame ? lensSupplier : frameSupplier;

      if (!primary) continue;

      const needsRelink =
        !p.supplierId ||
        String(p.supplierId) !== String(primary._id) ||
        !Array.isArray(p.suppliers) ||
        p.suppliers.length === 0;

      if (needsRelink) {
        const chain = [
          {
            supplierId: primary._id,
            supplierName: primary.name,
            phone: primary.phone || "01099887766",
            whatsapp: primary.whatsappPhone || primary.phone || "201099887766",
            priority: 1,
            supplyCost: p.costPrice || Math.round((p.price || 200) * 0.5),
            leadTimeHours: 24
          }
        ];
        if (secondary && String(secondary._id) !== String(primary._id)) {
          chain.push({
            supplierId: secondary._id,
            supplierName: secondary.name,
            phone: secondary.phone || "01122334455",
            whatsapp: secondary.whatsappPhone || secondary.phone || "201122334455",
            priority: 2,
            supplyCost: p.costPrice || Math.round((p.price || 200) * 0.55),
            leadTimeHours: 48
          });
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: p._id },
            update: {
              $set: {
                supplierId: primary._id,
                suppliers: chain
              }
            }
          }
        });
      }
    }

    if (bulkOps.length > 0) {
      await Products.bulkWrite(bulkOps);
    }
  }

  return suppliers;
}

// ---------------------------------------------------------------------------
// 1. READ PRIMITIVES (مكعبات الاستعلام والتحليل الذري)
// ---------------------------------------------------------------------------

/**
 * 1.1 Lookup Entity
 * Fast projected search across customers, products, orders, labs, and branches.
 */
async function lookupEntity({ subdomain, entityType, query, limit = 5 }) {
  if (!query || typeof query !== "string") {
    return { error: "يرجى تحديد نص البحث" };
  }
  const cleanQ = query.trim();
  const regex = new RegExp(cleanQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const lim = Math.min(Math.max(Number(limit) || 5, 1), 20);

  switch (entityType) {
    case "customer": {
      const Users = getUsersModel(subdomain);
      const isPhone = /^01[0-9]{9}$/.test(cleanQ);
      const filter = isPhone
        ? { phone: cleanQ }
        : {
            $or: [
              { phone: regex },
              { fullname: regex },
              { email: regex }
            ]
          };

      const docs = await Users.find(filter)
        .select("_id fullname phone email city prescriptions role active createdAt")
        .limit(lim)
        .lean();

      return {
        count: docs.length,
        results: docs.map((u) => ({
          id: String(u._id),
          name: u.fullname,
          phone: u.phone,
          email: u.email,
          city: u.city || "غير محدد",
          prescriptionsCount: (u.prescriptions || []).length,
          lastPrescription: u.prescriptions && u.prescriptions.length > 0
            ? u.prescriptions[u.prescriptions.length - 1].date
            : null
        }))
      };
    }

    case "product": {
      const Products = getProductsModel(subdomain);
      const { searchProducts } = require("../semantic-engine");

      // 1. Direct exact match check (SKU / Barcode / exact model code)
      const directDocs = await Products.find({
        $or: [
          { sku: cleanQ },
          { barcode: cleanQ },
          { "opticsSpecs.modelCode": cleanQ },
          { "frameSpecs.modelCode": cleanQ }
        ]
      })
        .select("_id name sku barcode price costPrice stockCount storeStock productType opticsSpecs frameSpecs lensSpecs scrapRecords")
        .limit(lim)
        .lean();

      if (directDocs.length > 0) {
        return {
          count: directDocs.length,
          searchEngine: "exact_code",
          results: directDocs.map((p) => {
            const os = p.opticsSpecs || p.frameSpecs || {};
            return {
              id: String(p._id),
              name: p.name,
              sku: p.sku || "N/A",
              barcode: p.barcode || "",
              type: p.productType || "general",
              sellingPrice: p.price,
              costPrice: p.costPrice || 0,
              currentStock: p.storeStock !== undefined ? p.storeStock : (p.stockCount || 0),
              brand: os.brand || "",
              modelCode: os.modelCode || "",
              similarityScore: 1.0,
              scrappedUnits: (p.scrapRecords || []).reduce((acc, s) => acc + (s.quantity || 0), 0)
            };
          })
        };
      }

      // 2. High-Dimensional Semantic Search via Vector Embeddings & Cosine Similarity
      try {
        const semanticRes = await searchProducts(subdomain, {
          query: cleanQ,
          limit: lim,
          minSimilarity: 0.35
        });

        const matchedProducts = semanticRes.products || [];
        if (matchedProducts.length > 0) {
          return {
            count: matchedProducts.length,
            searchEngine: "semantic_cosine_similarity",
            results: matchedProducts.map((p) => {
              const os = p.opticsSpecs || p.frameSpecs || {};
              return {
                id: String(p._id),
                name: p.name,
                sku: p.sku || "N/A",
                barcode: p.barcode || "",
                type: p.productType || "general",
                sellingPrice: p.price,
                costPrice: p.costPrice || 0,
                currentStock: p.storeStock !== undefined ? p.storeStock : (p.stockCount || 0),
                brand: os.brand || "",
                modelCode: os.modelCode || "",
                similarityScore: p.similarityScore,
                vectorSimilarity: p.vectorSimilarity,
                scrappedUnits: (p.scrapRecords || []).reduce((acc, s) => acc + (s.quantity || 0), 0)
              };
            })
          };
        }
      } catch (semErr) {
        console.warn("[COPILOT_SEMANTIC_SEARCH_FALLBACK] Error in semantic search, using regex:", semErr.message);
      }

      // 3. Fallback regex search
      const docs = await Products.find({
        $or: [
          { name: regex },
          { sku: regex },
          { barcode: regex },
          { "opticsSpecs.modelCode": regex },
          { "opticsSpecs.brand": regex },
          { "frameSpecs.modelCode": regex },
          { "frameSpecs.brand": regex }
        ]
      })
        .select("_id name sku barcode price costPrice stockCount storeStock productType opticsSpecs frameSpecs lensSpecs scrapRecords")
        .limit(lim)
        .lean();

      return {
        count: docs.length,
        searchEngine: "regex_fallback",
        results: docs.map((p) => {
          const os = p.opticsSpecs || p.frameSpecs || {};
          return {
            id: String(p._id),
            name: p.name,
            sku: p.sku || "N/A",
            barcode: p.barcode || "",
            type: p.productType || "general",
            sellingPrice: p.price,
            costPrice: p.costPrice || 0,
            currentStock: p.storeStock !== undefined ? p.storeStock : (p.stockCount || 0),
            brand: os.brand || "",
            modelCode: os.modelCode || "",
            scrappedUnits: (p.scrapRecords || []).reduce((acc, s) => acc + (s.quantity || 0), 0)
          };
        })
      };
    }

    case "order": {
      const Orders = getOrdersModel(subdomain);
      const docs = await Orders.find({
        $or: [
          { orderId: regex },
          { "customer.phone": regex },
          { "customer.name": regex }
        ]
      })
        .select("_id orderId customer status total paymentMethod paidAmount remainingAmount installment items createdAt")
        .sort({ createdAt: -1 })
        .limit(lim)
        .lean();

      return {
        count: docs.length,
        results: docs.map((o) => ({
          id: String(o._id),
          orderId: o.orderId,
          customerName: o.customer?.name || "عميل بدون اسم",
          customerPhone: o.customer?.phone || "",
          status: o.status,
          total: o.total,
          paid: o.paidAmount || 0,
          remaining: o.remainingAmount || 0,
          isInstallment: Boolean(o.installment?.isInstallment),
          itemNames: (o.items || []).map((it) => it.name).join(" + "),
          itemsCount: (o.items || []).length,
          createdAt: o.createdAt
        }))
      };
    }

    case "lab": {
      const Lab = getLabModel(subdomain);
      const docs = await Lab.find({
        $or: [{ name: regex }, { code: regex }, { phone: regex }]
      })
        .select("_id name code phone address rating active currentLoad")
        .limit(lim)
        .lean();

      return {
        count: docs.length,
        results: docs.map((l) => ({
          id: String(l._id),
          name: l.name,
          code: l.code,
          phone: l.phone,
          address: l.address,
          rating: l.rating || 5,
          active: l.active
        }))
      };
    }

    case "branch": {
      const Branch = getBranchModel(subdomain);
      const docs = await Branch.find({
        $or: [{ name: regex }, { code: regex }, { city: regex }]
      })
        .select("_id name code city address phone isMain active")
        .limit(lim)
        .lean();

      return {
        count: docs.length,
        results: docs.map((b) => ({
          id: String(b._id),
          name: b.name,
          code: b.code,
          city: b.city,
          address: b.address,
          phone: b.phone,
          isMain: b.isMain
        }))
      };
    }

    case "partner": {
      const res = await partnerService.listPartners(subdomain);
      const matched = (res.partners || []).filter((p) => regex.test(p.name) || regex.test(p.phone));
      return {
        count: matched.length,
        results: matched.slice(0, lim).map((p) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          sharePercentage: p.sharePercentage,
          initialCapital: p.initialCapital,
          totalWithdrawals: p.liveWithdrawals,
          statusNote: p.statusNote
        }))
      };
    }

    case "supplier": {
      const suppliers = await ensureDefaultSuppliersAndLinks(subdomain);
      const isGeneric = /^(all|الكل|مورد|موردين|اول|أول|1)$/i.test(cleanQ);
      const matched = isGeneric
        ? suppliers
        : suppliers.filter(
            (s) =>
              regex.test(s.name || "") ||
              regex.test(s.supplierCode || "") ||
              regex.test(s.phone || "") ||
              regex.test(s.specialty || "")
          );
      const finalList = matched.length > 0 ? matched : suppliers;
      return {
        count: finalList.length,
        results: finalList.slice(0, lim).map((s, idx) => ({
          id: String(s._id),
          priorityOrder: idx + 1,
          supplierCode: s.supplierCode,
          name: s.name,
          contactPerson: s.contactPerson || "",
          phone: s.phone || "",
          whatsappPhone: s.whatsappPhone || s.phone || "",
          specialty: s.specialty || "",
          address: s.address || ""
        }))
      };
    }

    default:
      return { error: `نوع الكيان غير مدعوم: ${entityType}. الخيارات المتاحة: customer, product, order, lab, branch, partner, supplier` };
  }
}

/**
 * 1.2 Get Entity Relations
 * Traversing cross-entity graphs (Customer -> Orders -> Prescriptions, Product -> Returns -> Scraps)
 */
async function getEntityRelations({ subdomain, entityType, entityId, relation }) {
  if (!entityId) {
    return { error: "معرّف الكيان (entityId) مطلوب" };
  }

  const isValidObjId = mongoose.isValidObjectId(entityId);

  switch (entityType) {
    case "customer": {
      const Users = getUsersModel(subdomain);
      const Orders = getOrdersModel(subdomain);
      const ReturnRequest = getReturnRequestModel(subdomain);

      const customer = await Users.findOne(
        isValidObjId ? { _id: entityId } : { phone: entityId }
      ).lean();

      if (!customer) return { error: "العميل غير موجود" };

      if (relation === "prescriptions") {
        return {
          customerName: customer.fullname,
          phone: customer.phone,
          prescriptions: customer.prescriptions || []
        };
      }

      if (relation === "orders") {
        const orders = await Orders.find({
          $or: [
            { "customer.phone": customer.phone },
            { user: customer._id }
          ]
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();

        return {
          customerName: customer.fullname,
          phone: customer.phone,
          ordersCount: orders.length,
          orders: orders.map((o) => ({
            id: String(o._id),
            orderId: o.orderId,
            status: o.status,
            total: o.total,
            items: (o.items || []).map((it) => ({
              name: it.name,
              quantity: it.quantity,
              price: it.price
            })),
            isInstallment: Boolean(o.installment?.isInstallment),
            createdAt: o.createdAt
          }))
        };
      }

      if (relation === "installments") {
        const orders = await Orders.find({
          $or: [
            { "customer.phone": customer.phone },
            { user: customer._id }
          ],
          "installment.isInstallment": true
        }).lean();

        const plans = orders.map((o) => ({
          orderId: o.orderId,
          totalAmount: o.installment.totalAmount,
          downPayment: o.installment.downPayment,
          remaining: o.installment.remainingAmount,
          status: o.installment.status,
          payments: o.installment.payments || []
        }));

        return {
          customerName: customer.fullname,
          phone: customer.phone,
          installmentPlansCount: plans.length,
          plans
        };
      }

      if (relation === "returns") {
        const returns = await ReturnRequest.find({
          "customer.phone": customer.phone
        }).lean();

        return {
          customerName: customer.fullname,
          returnsCount: returns.length,
          returns: returns.map((r) => ({
            id: String(r._id),
            orderId: r.orderId,
            status: r.status,
            reason: r.reason,
            items: r.items,
            createdAt: r.createdAt
          }))
        };
      }

      return { error: `علاقة غير مدعومة للعميل: ${relation}. الخيارات: prescriptions, orders, installments, returns` };
    }

    case "order": {
      const Orders = getOrdersModel(subdomain);
      const WorkOrder = getWorkOrderModel(subdomain);

      const order = await Orders.findOne(
        isValidObjId ? { $or: [{ _id: entityId }, { orderId: entityId }] } : { orderId: entityId }
      ).lean();

      if (!order) return { error: "الطلب غير موجود" };

      if (relation === "workOrders") {
        const workOrders = await WorkOrder.find({
          $or: [
            { orderId: order.orderId },
            { orderDbId: order._id }
          ]
        }).lean();

        return {
          orderId: order.orderId,
          workOrdersCount: workOrders.length,
          workOrders: workOrders.map((w) => ({
            workOrderNumber: w.workOrderNumber,
            labName: w.labName,
            currentStageLabel: w.currentStageLabel,
            status: w.status,
            expectedDeliveryDate: w.expectedDeliveryDate,
            items: w.items
          }))
        };
      }

      if (relation === "items") {
        return {
          orderId: order.orderId,
          items: order.items || [],
          total: order.total,
          discount: order.discountAmount || 0,
          couponCode: order.couponCode || null
        };
      }

      if (relation === "installments") {
        return {
          orderId: order.orderId,
          installment: order.installment || null
        };
      }

      return { error: `علاقة غير مدعومة للطلب: ${relation}. الخيارات: workOrders, items, installments` };
    }

    case "product": {
      const Products = getProductsModel(subdomain);
      const Orders = getOrdersModel(subdomain);
      const ReturnRequest = getReturnRequestModel(subdomain);

      const product = await Products.findById(entityId).lean();
      if (!product) return { error: "المنتج غير موجود" };

      if (relation === "scrapRecords") {
        return {
          productName: product.name,
          sku: product.sku,
          scrapRecords: product.scrapRecords || []
        };
      }

      if (relation === "returns") {
        const returns = await ReturnRequest.find({
          "items.productId": String(product._id)
        }).lean();

        return {
          productName: product.name,
          returnsCount: returns.length,
          returns: returns.map((r) => ({
            id: String(r._id),
            orderId: r.orderId,
            reason: r.reason,
            createdAt: r.createdAt
          }))
        };
      }

      if (relation === "salesHistory") {
        const orders = await Orders.find({
          "items.productId": String(product._id)
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();

        return {
          productName: product.name,
          salesOrdersCount: orders.length,
          recentOrders: orders.map((o) => ({
            orderId: o.orderId,
            date: o.createdAt,
            total: o.total,
            status: o.status
          }))
        };
      }

      return { error: `علاقة غير مدعومة للمنتج: ${relation}. الخيارات: scrapRecords, returns, salesHistory` };
    }

    default:
      return { error: `نوع الكيان غير مدعوم: ${entityType}` };
  }
}

/**
 * 1.3 Get Aggregated Metrics
 * High-precision quantitative metrics computation
 */
async function getAggregatedMetrics({ subdomain, targetType = "global", targetId = null, metrics = ["salesVolume", "returnRate"], periodDays = 30 }) {
  const Orders = getOrdersModel(subdomain);
  const Products = getProductsModel(subdomain);
  const ReturnRequest = getReturnRequestModel(subdomain);

  const days = Number(periodDays) || 30;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const orderFilter = {
    createdAt: { $gte: sinceDate },
    status: { $nin: ["cancelled"] }
  };

  const results = {
    periodDays: days,
    targetType,
    targetId
  };

  // 1. If target is a specific product
  if (targetType === "product" && targetId) {
    let prod = null;
    if (mongoose.isValidObjectId(targetId)) {
      prod = await Products.findById(targetId).lean();
    }
    if (!prod) {
      // Resolve semantically by name or keyword (e.g. تشمبر, فريم, نظارة, رايبان)
      const lookupRes = await lookupEntity({ subdomain, entityType: "product", query: String(targetId), limit: 1 });
      if (lookupRes.results && lookupRes.results.length > 0) {
        prod = await Products.findById(lookupRes.results[0].id).lean();
      }
    }
    if (!prod) return { error: `لم يتم العثور على المنتج المحدد: "${targetId}"` };

    const orders = await Orders.find({
      ...orderFilter,
      "items.productId": String(prod._id)
    }).lean();

    let unitsSold = 0;
    let salesRevenue = 0;
    orders.forEach((o) => {
      (o.items || []).forEach((it) => {
        if (String(it.productId) === String(prod._id)) {
          unitsSold += Number(it.quantity || 1);
          salesRevenue += Number(it.price || 0) * Number(it.quantity || 1);
        }
      });
    });

    const returns = await ReturnRequest.find({
      createdAt: { $gte: sinceDate },
      "items.productId": String(prod._id),
      status: { $ne: "rejected" }
    }).lean();

    let unitsReturned = 0;
    returns.forEach((r) => {
      (r.items || []).forEach((it) => {
        if (String(it.productId) === String(prod._id)) {
          unitsReturned += Number(it.quantity || 1);
        }
      });
    });

    const scrapUnits = (prod.scrapRecords || [])
      .filter((s) => !s.createdAt || new Date(s.createdAt) >= sinceDate)
      .reduce((acc, s) => acc + (s.quantity || 0), 0);

    const returnRate = unitsSold > 0 ? ((unitsReturned / unitsSold) * 100).toFixed(1) + "%" : "0%";
    const scrapRate = unitsSold > 0 ? ((scrapUnits / (unitsSold + scrapUnits)) * 100).toFixed(1) + "%" : "0%";

    results.productName = prod.name;
    results.unitsSold = unitsSold;
    results.salesRevenueEGP = salesRevenue;
    results.unitsReturned = unitsReturned;
    results.returnRate = returnRate;
    results.scrapUnits = scrapUnits;
    results.defectRate = scrapRate;
    results.currentStock = prod.storeStock !== undefined ? prod.storeStock : (prod.stockCount || 0);

    return results;
  }

  // 2. Global / Store-wide metrics
  const [allOrders, allProducts, allReturns] = await Promise.all([
    Orders.find(orderFilter).lean(),
    Products.find({}).lean(),
    ReturnRequest.find({ createdAt: { $gte: sinceDate }, status: { $ne: "rejected" } }).lean()
  ]);

  let totalSoldUnits = 0;
  let totalRevenue = 0;
  let totalCost = 0;
  let installmentOrdersCount = 0;
  let totalDuePayments = 0;
  let onTimePayments = 0;

  const now = new Date();

  allOrders.forEach((o) => {
    totalRevenue += Number(o.total || 0);
    (o.items || []).forEach((it) => {
      const q = Number(it.quantity || 1);
      totalSoldUnits += q;
      totalCost += Number(it.costPrice || 0) * q;
    });

    if (o.installment?.isInstallment) {
      installmentOrdersCount++;
      (o.installment.payments || []).forEach((p) => {
        const isPast = new Date(p.dueDate) <= now;
        if (p.status === "paid") {
          onTimePayments++;
          totalDuePayments++;
        } else if (isPast) {
          totalDuePayments++;
        }
      });
    }
  });

  let totalReturnedUnits = 0;
  allReturns.forEach((r) => {
    (r.items || []).forEach((it) => {
      totalReturnedUnits += Number(it.quantity || 1);
    });
  });

  let totalScrappedUnits = 0;
  let totalScrapLossEGP = 0;
  allProducts.forEach((p) => {
    (p.scrapRecords || []).forEach((s) => {
      if (!s.createdAt || new Date(s.createdAt) >= sinceDate) {
        totalScrappedUnits += Number(s.quantity || 1);
        totalScrapLossEGP += Number(s.totalLoss || 0);
      }
    });
  });

  const grossProfit = totalRevenue - totalCost;
  const profitMarginPercent = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) + "%" : "0%";
  const returnRatePercent = totalSoldUnits > 0 ? ((totalReturnedUnits / totalSoldUnits) * 100).toFixed(1) + "%" : "0%";
  const onTimeInstallmentRate = totalDuePayments > 0 ? ((onTimePayments / totalDuePayments) * 100).toFixed(1) + "%" : "100%";

  results.totalOrders = allOrders.length;
  results.totalSoldUnits = totalSoldUnits;
  results.totalRevenueEGP = Math.round(totalRevenue);
  results.grossProfitEGP = Math.round(grossProfit);
  results.profitMargin = profitMarginPercent;
  results.returnRate = returnRatePercent;
  results.totalScrappedUnits = totalScrappedUnits;
  results.totalScrapLossEGP = Math.round(totalScrapLossEGP);
  results.onTimeInstallmentRate = onTimeInstallmentRate;

  return results;
}

/**
 * 1.4 Get Treasury Summary
 * Quick cash, revenue, expenses, and pending dues
 */
async function getTreasurySummary({ subdomain, periodDays = 7, branchId = null }) {
  const Orders = getOrdersModel(subdomain);
  const days = Number(periodDays) || 7;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const orderFilter = {
    createdAt: { $gte: sinceDate },
    status: { $nin: ["cancelled"] }
  };
  if (branchId && mongoose.isValidObjectId(branchId)) {
    orderFilter.branchId = branchId;
  }

  const orders = await Orders.find(orderFilter).lean();

  let cashSales = 0;
  let cardSales = 0;
  let collectedInstallments = 0;
  let totalRevenue = 0;
  let pendingReceivables = 0;

  orders.forEach((o) => {
    totalRevenue += Number(o.total || 0);
    const paid = Number(o.paidAmount || 0);
    const method = String(o.paymentMethod || "cash").toLowerCase();

    if (method === "card" || method === "wallet") {
      cardSales += paid;
    } else {
      cashSales += paid;
    }

    if (o.installment?.isInstallment) {
      pendingReceivables += Number(o.installment.remainingAmount || 0);
      (o.installment.payments || []).forEach((p) => {
        if (p.status === "paid" && (!p.paidAt || new Date(p.paidAt) >= sinceDate)) {
          collectedInstallments += Number(p.amount || 0);
        }
      });
    }
  });

  // Query expenses through expense service
  let expensesList = [];
  try {
    const expResult = await expensesService.listExpenses(subdomain, {
      from: sinceDate.toISOString(),
      limit: 100
    });
    expensesList = expResult?.expenses || [];
  } catch (err) {
    console.warn("[COPILOT_EXPENSES_WARN]:", err.message);
  }

  const totalExpenses = expensesList.reduce((acc, ex) => acc + (Number(ex.amount) || 0), 0);
  const netOperatingCash = (cashSales + cardSales + collectedInstallments) - totalExpenses;

  return {
    periodDays: days,
    totalRevenueEGP: Math.round(totalRevenue),
    cashSalesEGP: Math.round(cashSales),
    cardSalesEGP: Math.round(cardSales),
    collectedInstallmentsEGP: Math.round(collectedInstallments),
    totalExpensesEGP: Math.round(totalExpenses),
    netOperatingCashEGP: Math.round(netOperatingCash),
    pendingReceivablesEGP: Math.round(pendingReceivables),
    recentExpensesCount: expensesList.length
  };
}

/**
 * 1.5 Search Catalog And Inventory
 */
async function searchCatalogAndInventory({ subdomain, keyword, category, minStock, maxStock, maxPrice }) {
  const Products = getProductsModel(subdomain);
  const { searchProducts } = require("../semantic-engine");

  let docs = [];

  if (keyword || category) {
    try {
      const semanticRes = await searchProducts(subdomain, {
        query: (keyword && typeof keyword === "string" && keyword.trim()) ? keyword.trim() : (category || "منتجات"),
        categoryId: category,
        maxPrice: maxPrice ? Number(maxPrice) : null,
        limit: 15,
        minSimilarity: 0.35
      });
      if (semanticRes.products && semanticRes.products.length > 0) {
        docs = semanticRes.products;
      }
    } catch (err) {
      console.warn("[SEARCH_INVENTORY_SEMANTIC_ERR]", err.message);
    }
  }

  if (docs.length === 0) {
    const filter = {};
    if (keyword) {
      const regex = new RegExp(keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: regex },
        { sku: regex },
        { "opticsSpecs.brand": regex },
        { "opticsSpecs.modelCode": regex },
        { "frameSpecs.brand": regex },
        { "frameSpecs.modelCode": regex }
      ];
    }

    if (category) {
      const catLower = String(category).trim().toLowerCase();
      if (/frame|إطار|شنبر|شمبر|نظار/i.test(catLower)) {
        filter.productType = { $in: ["frame", "sunglass"] };
      } else if (/lens|عدس/i.test(catLower)) {
        filter.productType = { $in: ["lens", "contact_lens"] };
      } else if (mongoose.isValidObjectId(category)) {
        filter.categoryId = new mongoose.Types.ObjectId(category);
      }
    }

    if (maxPrice) {
      filter.price = { $lte: Number(maxPrice) };
    }

    docs = await Products.find(filter)
      .select("_id name sku price costPrice storeStock stockCount productType opticsSpecs frameSpecs")
      .limit(15)
      .lean();
  }

  let results = docs.map((p) => {
    const stock = p.storeStock !== undefined ? p.storeStock : (p.stockCount || 0);
    const os = p.opticsSpecs || p.frameSpecs || {};
    return {
      id: String(p._id),
      name: p.name,
      sku: p.sku || "N/A",
      price: p.price,
      costPrice: p.costPrice || 0,
      stock,
      brand: os.brand || "",
      modelCode: os.modelCode || "",
      type: p.productType || "general",
      similarityScore: p.similarityScore
    };
  });

  if (minStock !== undefined) {
    results = results.filter((r) => r.stock >= Number(minStock));
  }
  if (maxStock !== undefined) {
    results = results.filter((r) => r.stock <= Number(maxStock));
  }

  return {
    count: results.length,
    items: results
  };
}

// ---------------------------------------------------------------------------
// 2. WRITE PRIMITIVES (مكعبات العمليات التنفيذية المعتمدة والصلبة)
// ---------------------------------------------------------------------------

/**
 * Helper to execute an Express controller synchronously
 */
function invokeController(controllerFn, reqMock) {
  return new Promise((resolve, reject) => {
    const resMock = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        if (this.statusCode >= 400) {
          reject(new Error(data.error || data.message || `فشلت العملية برمز ${this.statusCode}`));
        } else {
          resolve(data);
        }
      }
    };
    controllerFn(reqMock, resMock, (err) => {
      if (err) reject(err);
      else resolve(null);
    });
  });
}

/**
 * 2.1 Record Expense (مع دعم التحقق والتأكيد الإداري المسبق)
 */
async function recordExpense({
  subdomain,
  user,
  title,
  category = "operational",
  amount,
  notes = "",
  branchId = null,
  partnerId = null,
  partnerName = "",
  confirmed = false
}) {
  if (!title || !amount) {
    return { error: "يرجى تحديد عنوان المصروف وقيمته" };
  }

  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return { error: "يرجى تحديد مبلغ صحيح للمصروف" };
  }

  // Human-in-the-Loop Confirmation Guard:
  // If expense is >= 1000 EGP or is a partner withdrawal, ask for confirmation first!
  if (!confirmed && (amt >= 1000 || category === "partner_withdrawal")) {
    return {
      requiresConfirmation: true,
      pendingAction: {
        action: "recordExpense",
        title: category === "partner_withdrawal" ? "تأكيد صرف مسحوبات شريك" : "تأكيد تسجيل قيد مصروف مالي",
        details: `تسجيل مصروف بقيمة ${amt.toLocaleString()} ج.م بعنوان: "${title.trim()}" (تصنيف: ${category})`,
        payload: {
          title: title.trim(),
          category,
          amount: amt,
          notes,
          branchId,
          partnerId,
          partnerName,
          confirmed: true
        }
      },
      clarification: {
        question: `المبلغ المطلوب (${amt.toLocaleString()} ج.م) يستوجب الاعتماد المالي. هل تؤكد صرف وقيد هذا المصروف الآن؟`,
        options: ["نعم، اعتمد واصرف المصروف الآن", "تعديل المبلغ والبيان", "إلغاء العملية"]
      }
    };
  }

  const expenseData = {
    title: title.trim(),
    category,
    amount: amt,
    notes: notes || "مسجل عبر المساعد التنفيذي الذكي (AI Copilot)",
    branchId: branchId || user?.branchId || null,
    partnerId: partnerId || null,
    partnerName: partnerName || ""
  };

  const created = await expensesService.createExpense(subdomain, expenseData, user);

  // Write to Audit Log
  try {
    const AuditLog = getAuditLogModel(subdomain);
    await AuditLog.create({
      userId: user?._id || null,
      userName: user?.fullname || "المساعد الذكي (AI Copilot)",
      userRole: user?.role || "admin",
      action: "copilot_record_expense",
      actionLabel: "تسجيل مصروف تشغيلي عبر المساعد الذكي",
      targetType: "finance",
      targetId: String(created._id || created.expense?._id || ""),
      targetCode: created.expenseCode || created.expense?.expenseCode || "",
      details: `تم تسجيل مصروف بقيمة ${amt.toLocaleString()} ج.م (${title}) تحت تصنيف: ${category}`,
      metadata: { amount: amt, title, category, actor: "AI_COPILOT" }
    });
  } catch (auditErr) {
    console.warn("[COPILOT_AUDIT_EXPENSE_WARN]:", auditErr.message);
  }

  return {
    success: true,
    message: `تم تسجيل المصروف بنجاح بقيمة ${amt.toLocaleString()} ج.م كود: ${created.expenseCode || created.expense?.expenseCode || "EXP"}`,
    expense: created
  };
}

/**
 * 2.2 Create POS Sale (مع طلب تأكيد العملية قبل الخصم وإثبات الإيراد)
 */
async function createPosSale({
  subdomain,
  user,
  customerPhone,
  customerName = "عميل نقطة البيع",
  items,
  paymentMethod = "cash",
  paidAmount,
  couponCode = null,
  notes = "",
  confirmed = false
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "يرجى تحديد المنتجات المراد بيعها" };
  }

  // Human-in-the-Loop Confirmation Guard:
  if (!confirmed) {
    const totalEst = items.reduce((acc, it) => acc + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
    return {
      requiresConfirmation: true,
      pendingAction: {
        action: "createPosSale",
        title: "تأكيد إصدار فاتورة بيع مباشرة (POS)",
        details: `إنشاء فاتورة بيع للعميل ${customerName} (${customerPhone || 'بدون هاتف'}) بقيمة تقديرية ${totalEst.toLocaleString()} ج.م (${items.length} أصناف). طريقة الدفع: ${paymentMethod}`,
        payload: {
          customerPhone,
          customerName,
          items,
          paymentMethod,
          paidAmount,
          couponCode,
          notes,
          confirmed: true
        }
      },
      clarification: {
        question: `هل تؤكد إنشاء الفاتورة وحسم المخزون فورياً للعميل ${customerName}؟`,
        options: ["نعم، أصدر الفاتورة واخصم المخزون الآن", "مراجعة الأصناف والأسعار", "إلغاء العملية"]
      }
    };
  }

  const reqMock = {
    subdomain,
    user,
    body: {
      customer: {
        phone: customerPhone || "01000000000",
        name: customerName || "عميل مباشر"
      },
      items,
      paymentMethod,
      paidAmount: paidAmount !== undefined ? Number(paidAmount) : undefined,
      couponCode: couponCode || undefined,
      notes: notes || "تم إنشاء الفاتورة آلياً بواسطة المساعد التنفيذي الذكي (AI Copilot)"
    }
  };

  try {
    const orderResult = await invokeController(ordersController.createPosOrder, reqMock);

    // Audit log
    try {
      const AuditLog = getAuditLogModel(subdomain);
      await AuditLog.create({
        userId: user?._id || null,
        userName: user?.fullname || "المساعد الذكي (AI Copilot)",
        userRole: user?.role || "admin",
        action: "copilot_create_pos_sale",
        actionLabel: "إنشاء فاتورة بيع عبر المساعد الذكي",
        targetType: "order",
        targetId: String(orderResult.order?._id || ""),
        targetCode: orderResult.order?.orderId || "",
        details: `تم إتمام عملية بيع برقم فاتورة: ${orderResult.order?.orderId} بقيمة إجمالية: ${orderResult.order?.total} ج.م`,
        metadata: { orderId: orderResult.order?.orderId, total: orderResult.order?.total, actor: "AI_COPILOT" }
      });
    } catch (auditErr) {
      console.warn("[COPILOT_AUDIT_SALE_WARN]:", auditErr.message);
    }

    return {
      success: true,
      message: `تم إنشاء الفاتورة بنجاح برقم: ${orderResult.order?.orderId}`,
      orderId: orderResult.order?.orderId,
      total: orderResult.order?.total,
      paidAmount: orderResult.order?.paidAmount
    };
  } catch (err) {
    return { error: `فشل إنشاء الفاتورة: ${err.message}` };
  }
}

/**
 * 2.3 List Partners Ledger (استعراض قائمة الشركاء وحصصهم ومسحوباتهم)
 */
async function listPartnersLedger({ subdomain }) {
  return await partnerService.listPartners(subdomain);
}

/**
 * 2.4 Record Partner Withdrawal (تسجيل مسحوبات الشركاء مع تأكيد مسبق)
 */
async function recordPartnerWithdrawal({
  subdomain,
  user,
  partnerId = null,
  partnerName = "",
  amount,
  notes = "",
  confirmed = false
}) {
  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return { error: "يرجى تحديد مبلغ المسحوبات للشريك" };
  }

  // Resolve partner if name was passed
  let resolvedId = partnerId;
  let resolvedName = partnerName || "";
  const listRes = await partnerService.listPartners(subdomain);
  const partners = listRes.partners || [];

  if (!resolvedId && resolvedName) {
    const found = partners.find((p) => p.name.includes(resolvedName.trim()));
    if (found) {
      resolvedId = found.id;
      resolvedName = found.name;
    }
  } else if (resolvedId && !resolvedName) {
    const found = partners.find((p) => String(p.id) === String(resolvedId));
    if (found) resolvedName = found.name;
  }

  if (!resolvedId && partners.length > 0) {
    // If only one partner exists, pick them
    if (partners.length === 1) {
      resolvedId = partners[0].id;
      resolvedName = partners[0].name;
    } else {
      return {
        requiresConfirmation: false,
        clarification: {
          question: `لديك ${partners.length} شركاء مسجلين. يرجى تحديد اسم الشريك المراد تسجيل المسحوبات له:`,
          options: partners.map((p) => `صرف للشريك ${p.name}`)
        }
      };
    }
  }

  // Human-in-the-Loop Confirmation
  if (!confirmed) {
    return {
      requiresConfirmation: true,
      pendingAction: {
        action: "recordPartnerWithdrawal",
        title: "تأكيد صرف مسحوبات شريك",
        details: `صرف مبلغ ${amt.toLocaleString()} ج.م للشريك: ${resolvedName || "الشريك المحدد"} وقيدها في سجل مسحوبات الشركاء بالخزينة.`,
        payload: {
          partnerId: resolvedId,
          partnerName: resolvedName,
          amount: amt,
          notes: notes || `مسحوبات شخصية للشريك ${resolvedName}`,
          confirmed: true
        }
      },
      clarification: {
        question: `هل تؤكد صرف مبلغ ${amt.toLocaleString()} ج.م للشريك ${resolvedName} من الخزينة؟`,
        options: ["نعم، اعتمد واصرف الآن", "تعديل المبلغ", "إلغاء العملية"]
      }
    };
  }

  return await partnerService.recordPartnerWithdrawal(
    subdomain,
    {
      partnerId: resolvedId,
      amount: amt,
      notes: notes || `مسحوبات شخصية للشريك ${resolvedName}`,
      paymentMethod: "cash"
    },
    user
  );
}

/**
 * 2.3 Create Work Order (إرسال أمر شغل لمعمل أو ورشة)
 */
async function createWorkOrder({ subdomain, user, orderId, labId, expectedDeliveryDate, notes = "" }) {
  if (!orderId || !labId) {
    return { error: "يرجى تحديد رقم الفاتورة/الطلب ومعرف المعمل (labId)" };
  }

  const { createWorkOrder: controllerCreateWorkOrder } = require("../labs/labsController");

  const reqMock = {
    subdomain,
    user,
    body: {
      orderId,
      labId,
      expectedDeliveryDate: expectedDeliveryDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      notes: notes || "تم إصدار أمر الشغل بواسطة المساعد التنفيذي الذكي"
    }
  };

  try {
    const resResult = await invokeController(controllerCreateWorkOrder, reqMock);

    // Audit log
    try {
      const AuditLog = getAuditLogModel(subdomain);
      await AuditLog.create({
        userId: user?._id || null,
        userName: user?.fullname || "المساعد الذكي (AI Copilot)",
        userRole: user?.role || "admin",
        action: "copilot_create_work_order",
        actionLabel: "إصدار أمر شغل للمعمل عبر المساعد الذكي",
        targetType: "work_order",
        targetId: String(resResult.workOrder?._id || ""),
        targetCode: resResult.workOrder?.workOrderNumber || "",
        details: `تم توجيه أمر شغل برقم: ${resResult.workOrder?.workOrderNumber} للمعمل: ${resResult.workOrder?.labName} للطلب: ${orderId}`,
        metadata: { workOrderNumber: resResult.workOrder?.workOrderNumber, labId, orderId, actor: "AI_COPILOT" }
      });
    } catch (auditErr) {
      console.warn("[COPILOT_AUDIT_WO_WARN]:", auditErr.message);
    }

    return {
      success: true,
      message: `تم إصدار أمر الشغل بنجاح برقم: ${resResult.workOrder?.workOrderNumber}`,
      workOrder: resResult.workOrder
    };
  } catch (err) {
    return { error: `فشل إصدار أمر الشغل: ${err.message}` };
  }
}

/**
 * 2.4 Record Customer Prescription (تسجيل كشف نظر للعميل)
 */
async function recordCustomerPrescription({
  subdomain,
  user,
  customerPhone,
  customerId,
  doctorName = "طبيب المركز",
  rightEye = {},
  leftEye = {},
  notes = ""
}) {
  const Users = getUsersModel(subdomain);
  const filter = customerId && mongoose.isValidObjectId(customerId)
    ? { _id: customerId }
    : { phone: customerPhone };

  const customer = await Users.findOne(filter);
  if (!customer) {
    return { error: "لم يتم العثور على العميل لتسجيل كشف النظر" };
  }

  const newPrescription = {
    date: new Date(),
    doctorName: doctorName || "طبيب المركز",
    rightEye: {
      sph: rightEye.sph || "",
      cyl: rightEye.cyl || "",
      axis: rightEye.axis || "",
      add: rightEye.add || "",
      pd: rightEye.pd || ""
    },
    leftEye: {
      sph: leftEye.sph || "",
      cyl: leftEye.cyl || "",
      axis: leftEye.axis || "",
      add: leftEye.add || "",
      pd: leftEye.pd || ""
    },
    notes: notes || "مسجل عبر المساعد الذكي"
  };

  customer.prescriptions = customer.prescriptions || [];
  customer.prescriptions.push(newPrescription);
  await customer.save();

  // Audit
  try {
    const AuditLog = getAuditLogModel(subdomain);
    await AuditLog.create({
      userId: user?._id || null,
      userName: user?.fullname || "المساعد الذكي (AI Copilot)",
      userRole: user?.role || "admin",
      action: "copilot_record_prescription",
      actionLabel: "تسجيل كشف نظر للعميل عبر المساعد الذكي",
      targetType: "customer",
      targetId: String(customer._id),
      targetCode: customer.phone,
      details: `تم إضافة قياسات كشف نظر جديدة للعميل: ${customer.fullname} (${customer.phone})`,
      metadata: { customerPhone: customer.phone, actor: "AI_COPILOT" }
    });
  } catch (auditErr) {
    console.warn("[COPILOT_AUDIT_PRESCRIPTION_WARN]:", auditErr.message);
  }

  return {
    success: true,
    message: `تم تسجيل قياسات كشف النظر بنجاح للعميل ${customer.fullname}`,
    customerName: customer.fullname,
    prescriptionsCount: customer.prescriptions.length
  };
}

/**
 * Helper: Extract depleted (0) and critical (<= criticalThreshold) cells from a lens product's matrixStock
 */
function inspectProductLensMatrix(p) {
  const crit = p.criticalStockThreshold !== undefined ? Number(p.criticalStockThreshold) : 3;
  const matrixStock = p.opticsSpecs?.matrixStock || {};
  const outOfStockCells = [];
  const criticalCells = [];

  for (const [cell, rawQty] of Object.entries(matrixStock)) {
    if (!cell.includes("_") || typeof rawQty === "object") continue;
    const q = Number(rawQty);
    if (Number.isNaN(q)) continue;
    const [sph, cyl] = cell.split("_");
    if (q <= 0) {
      outOfStockCells.push({ cell, sph, cyl: cyl || "0.00", qty: 0, neededQty: Math.max(4, crit + 1) });
    } else if (q <= crit) {
      criticalCells.push({ cell, sph, cyl: cyl || "0.00", qty: q, neededQty: Math.max(2, crit * 2 - q) });
    }
  }

  // Sort out-of-stock first, then lowest quantity
  const allDepleted = [...outOfStockCells, ...criticalCells.sort((a, b) => a.qty - b.qty)];
  const formattedTopCells = allDepleted.slice(0, 12).map((c) =>
    c.qty <= 0
      ? `SPH ${c.sph} / CYL ${c.cyl} (رصيد: 0 - نافد تماماً، مطلوب: ${c.neededQty})`
      : `SPH ${c.sph} / CYL ${c.cyl} (رصيد: ${c.qty} - حرج، مطلوب: ${c.neededQty})`
  );

  if (allDepleted.length > 12) {
    formattedTopCells.push(`... بالإضافة إلى ${allDepleted.length - 12} مقاس آخر تحت الحد الحرج في الدرج`);
  }

  const totalNeededPairs = allDepleted.reduce((acc, c) => acc + c.neededQty, 0);

  return {
    isMatrixManaged: Boolean(p.opticsSpecs?.isMatrixManaged || Object.keys(matrixStock).length > 0),
    outOfStockCellsCount: outOfStockCells.length,
    criticalCellsCount: criticalCells.length,
    totalDepletedOrCriticalCells: allDepleted.length,
    totalNeededPairsForDrawer: totalNeededPairs,
    depletedMatrixCells: formattedTopCells,
    rawDepletedCells: allDepleted
  };
}

/**
 * 2.5 Get Low Stock / Missing Items & Suppliers (فحص النواقص والأصناف الحرجةودرج العدسات والموردين)
 */
async function getLowStockAndSuppliers({
  subdomain,
  threshold = 8,
  productType = "all",
  onlyMatrixDepleted = false
}) {
  const suppliers = await ensureDefaultSuppliersAndLinks(subdomain);
  const Products = getProductsModel(subdomain);

  const allProducts = await Products.find({ active: true })
    .populate("supplierId", "name phone whatsappPhone supplierCode specialty notes")
    .select("_id name sku barcode productType price costPrice stockCount storeStock criticalStockThreshold reorderQuantity opticsSpecs supplierId")
    .lean();

  const maxThresh = Math.max(Number(threshold) || 8, 5);
  const evaluated = allProducts.map((p) => {
    const currentStock = p.storeStock !== undefined && p.storeStock > 0 ? p.storeStock : (p.stockCount || 0);
    const crit = p.criticalStockThreshold !== undefined ? Number(p.criticalStockThreshold) : 3;
    const matrixInfo = inspectProductLensMatrix(p);

    const isLensItem =
      p.productType === "lens" ||
      p.productType === "contact_lens" ||
      matrixInfo.isMatrixManaged ||
      /عدس/i.test(p.name || "");

    const suggestedQty =
      matrixInfo.isMatrixManaged && matrixInfo.totalDepletedOrCriticalCells > 0
        ? matrixInfo.totalNeededPairsForDrawer
        : Math.max(10, Number(p.reorderQuantity) || 15);

    return {
      id: String(p._id),
      name: p.name,
      sku: p.sku || p.barcode || "",
      type: p.productType || (isLensItem ? "lens" : "frame"),
      isMatrixManaged: matrixInfo.isMatrixManaged,
      currentStock,
      criticalThreshold: crit,
      suggestedOrderQty: suggestedQty,
      unitCost: p.costPrice || Math.round((p.price || 200) * 0.5),
      sellingPrice: p.price || 0,
      outOfStockMatrixCellsCount: matrixInfo.outOfStockCellsCount,
      criticalMatrixCellsCount: matrixInfo.criticalCellsCount,
      totalDepletedMatrixCellsCount: matrixInfo.totalDepletedOrCriticalCells,
      depletedMatrixCells: matrixInfo.depletedMatrixCells,
      rawDepletedCells: matrixInfo.rawDepletedCells,
      isLowOrCritical: currentStock <= Math.max(crit, maxThresh) || matrixInfo.totalDepletedOrCriticalCells > 0,
      supplierName: p.supplierId?.name || suppliers[0]?.name || "الشركة الدولية للبصريات وتجهيز العدسات",
      supplierPhone: p.supplierId?.phone || suppliers[0]?.phone || "",
      supplierId: String(p.supplierId?._id || suppliers[0]?._id || "")
    };
  });

  const normalizedType = String(productType || "all").toLowerCase().trim();
  let filtered = evaluated;
  if (onlyMatrixDepleted || normalizedType === "lens" || normalizedType === "lenses" || normalizedType === "contact_lens") {
    filtered = evaluated.filter(
      (p) =>
        p.type === "lens" ||
        p.type === "contact_lens" ||
        p.isMatrixManaged ||
        p.totalDepletedMatrixCellsCount > 0
    );
  } else if (normalizedType === "frame" || normalizedType === "sunglass") {
    filtered = evaluated.filter((p) => p.type === "frame" || p.type === "sunglass");
  }

  filtered.sort((a, b) => {
    if (b.outOfStockMatrixCellsCount !== a.outOfStockMatrixCellsCount) {
      return b.outOfStockMatrixCellsCount - a.outOfStockMatrixCellsCount;
    }
    return a.currentStock - b.currentStock;
  });

  let lowStockItems = filtered.filter((p) => p.isLowOrCritical);
  if (lowStockItems.length === 0) {
    lowStockItems = filtered.slice(0, 5);
  }

  const lensDrawerItems = evaluated.filter((p) => p.isMatrixManaged && p.totalDepletedMatrixCellsCount > 0);

  return {
    filterApplied: onlyMatrixDepleted ? "lens_matrix_drawer" : normalizedType,
    lowStockCount: lowStockItems.length,
    lowStockItems,
    lensDrawerSummary: {
      totalLensTypesWithShortages: lensDrawerItems.length,
      totalOutOfStockDrawerSlots: lensDrawerItems.reduce((acc, l) => acc + l.outOfStockMatrixCellsCount, 0),
      totalCriticalDrawerSlots: lensDrawerItems.reduce((acc, l) => acc + l.criticalMatrixCellsCount, 0),
      lensTypes: lensDrawerItems.map((l) => ({
        id: l.id,
        name: l.name,
        outOfStockSlotsCount: l.outOfStockMatrixCellsCount,
        criticalSlotsCount: l.criticalMatrixCellsCount,
        totalDepletedSlotsCount: l.totalDepletedMatrixCellsCount,
        suggestedTotalPairsToOrder: l.suggestedOrderQty,
        topDepletedPowers: l.depletedMatrixCells.slice(0, 8),
        supplierName: l.supplierName,
        supplierId: l.supplierId
      }))
    },
    suppliers: suppliers.map((s, idx) => ({
      id: String(s._id),
      order: idx + 1,
      code: s.supplierCode,
      name: s.name,
      phone: s.phone,
      whatsappPhone: s.whatsappPhone || s.phone,
      specialty: s.specialty || s.notes || ""
    })),
    firstSupplier: suppliers[0]
      ? {
          id: String(suppliers[0]._id),
          name: suppliers[0].name,
          phone: suppliers[0].phone,
          whatsappPhone: suppliers[0].whatsappPhone || suppliers[0].phone,
          specialty: suppliers[0].specialty || suppliers[0].notes || ""
        }
      : null
  };
}

/**
 * 2.6 Create Supply Order, Generate Tracking Link & Send WhatsApp to Supplier
 * (إنشاء طلب توريد فعلي في قاعدة البيانات + توليد رابط متابعة التوريد المباشر + توليد وإرسال رسالة واتساب للمورد)
 */
async function createSupplyOrderAndWhatsApp({
  subdomain,
  user,
  items = [],
  productIds = [],
  productType = "all",
  onlyMatrixDepleted = false,
  supplierId = null,
  supplierName = "",
  defaultQuantity = 15,
  notes = ""
}) {
  const suppliers = await ensureDefaultSuppliersAndLinks(subdomain);
  const Products = getProductsModel(subdomain);

  const isLensOrderHint =
    onlyMatrixDepleted ||
    /^(lens|lenses|contact_lens)$/i.test(String(productType || "")) ||
    /عدس|درج|مصفوف/i.test(String(notes || ""));

  // 1. Resolve Products to Order
  const resolvedItems = [];

  if (Array.isArray(items) && items.length > 0) {
    for (const it of items) {
      let prod = null;
      const pid = it.productId || it.id;
      const pname = it.name || it.productName || "";

      if (pid && mongoose.isValidObjectId(pid)) {
        prod = await Products.findById(pid).populate("supplierId").lean();
      }
      if (!prod && pname) {
        const lookupRes = await lookupEntity({ subdomain, entityType: "product", query: pname, limit: 1 });
        if (lookupRes.results && lookupRes.results.length > 0) {
          prod = await Products.findById(lookupRes.results[0].id).populate("supplierId").lean();
        }
      }

      if (prod) {
        const matrixInfo = inspectProductLensMatrix(prod);
        const qty = Math.max(
          1,
          Number(it.quantity) ||
            (matrixInfo.isMatrixManaged && matrixInfo.totalNeededPairsForDrawer > 0
              ? matrixInfo.totalNeededPairsForDrawer
              : Number(prod.reorderQuantity) || defaultQuantity)
        );
        const unitCost = Number(it.unitCost) || Number(prod.costPrice) || Math.round((prod.price || 200) * 0.5);
        resolvedItems.push({
          productId: prod._id,
          name: prod.name,
          sku: prod.sku || prod.barcode || "",
          productType: prod.productType,
          supplierDoc: prod.supplierId,
          currentStock: prod.storeStock !== undefined ? prod.storeStock : (prod.stockCount || 0),
          quantity: qty,
          unitCost,
          lineTotal: qty * unitCost,
          matrixBreakdown: matrixInfo.rawDepletedCells || [],
          depletedPowersSummary:
            matrixInfo.isMatrixManaged && matrixInfo.rawDepletedCells.length > 0
              ? matrixInfo.rawDepletedCells
                  .slice(0, 4)
                  .map((c) => `${c.sph}/${c.cyl}×${c.neededQty}`)
                  .join("، ") +
                (matrixInfo.rawDepletedCells.length > 4 ? ` (+${matrixInfo.rawDepletedCells.length - 4} مقاس)` : "")
              : ""
        });
      } else if (pname) {
        const qty = Math.max(1, Number(it.quantity) || defaultQuantity);
        const unitCost = Number(it.unitCost) || 150;
        resolvedItems.push({
          productId: null,
          name: pname,
          sku: "CUSTOM",
          currentStock: 0,
          quantity: qty,
          unitCost,
          lineTotal: qty * unitCost,
          matrixBreakdown: [],
          depletedPowersSummary: ""
        });
      }
    }
  }

  if (resolvedItems.length === 0 && Array.isArray(productIds) && productIds.length > 0) {
    for (const pid of productIds) {
      if (mongoose.isValidObjectId(pid)) {
        const prod = await Products.findById(pid).populate("supplierId").lean();
        if (prod) {
          const matrixInfo = inspectProductLensMatrix(prod);
          const qty =
            matrixInfo.isMatrixManaged && matrixInfo.totalNeededPairsForDrawer > 0
              ? matrixInfo.totalNeededPairsForDrawer
              : Math.max(1, Number(prod.reorderQuantity) || defaultQuantity);
          const unitCost = Number(prod.costPrice) || Math.round((prod.price || 200) * 0.5);
          resolvedItems.push({
            productId: prod._id,
            name: prod.name,
            sku: prod.sku || prod.barcode || "",
            productType: prod.productType,
            supplierDoc: prod.supplierId,
            currentStock: prod.storeStock !== undefined ? prod.storeStock : (prod.stockCount || 0),
            quantity: qty,
            unitCost,
            lineTotal: qty * unitCost,
            matrixBreakdown: matrixInfo.rawDepletedCells || [],
            depletedPowersSummary:
              matrixInfo.isMatrixManaged && matrixInfo.rawDepletedCells.length > 0
                ? matrixInfo.rawDepletedCells
                    .slice(0, 4)
                    .map((c) => `${c.sph}/${c.cyl}×${c.neededQty}`)
                    .join("، ") +
                  (matrixInfo.rawDepletedCells.length > 4 ? ` (+${matrixInfo.rawDepletedCells.length - 4} مقاس)` : "")
                : ""
          });
        }
      }
    }
  }

  // If no explicit items were passed, auto-discover low-stock items (respecting productType / onlyMatrixDepleted!)
  if (resolvedItems.length === 0) {
    const lowStockData = await getLowStockAndSuppliers({
      subdomain,
      threshold: 8,
      productType: isLensOrderHint ? "lens" : productType,
      onlyMatrixDepleted: isLensOrderHint || onlyMatrixDepleted
    });
    for (const lp of lowStockData.lowStockItems) {
      const rawCells = Array.isArray(lp.rawDepletedCells) ? lp.rawDepletedCells : [];
      resolvedItems.push({
        productId: lp.id,
        name: lp.name,
        sku: lp.sku || "",
        productType: lp.type,
        currentStock: lp.currentStock,
        quantity: lp.suggestedOrderQty || defaultQuantity,
        unitCost: lp.unitCost || 150,
        lineTotal: (lp.suggestedOrderQty || defaultQuantity) * (lp.unitCost || 150),
        matrixBreakdown: rawCells,
        depletedPowersSummary:
          rawCells.length > 0
            ? rawCells
                .slice(0, 4)
                .map((c) => `${c.sph}/${c.cyl}×${c.neededQty}`)
                .join("، ") +
              (rawCells.length > 4 ? ` (+${rawCells.length - 4} مقاس بالدرج)` : "")
            : ""
      });
    }
  }

  if (resolvedItems.length === 0) {
    return { error: "لم يتم العثور على أصناف لإدراجها في طلب التوريد" };
  }

  // 2. Resolve Target Supplier
  let targetSupplier = null;
  if (supplierId && mongoose.isValidObjectId(supplierId)) {
    targetSupplier = suppliers.find((s) => String(s._id) === String(supplierId)) || null;
  }
  if (!targetSupplier && supplierName && typeof supplierName === "string") {
    const cleanSup = supplierName.replace(/أول مورد|اول مورد|المورد الأول|المورد الاول/gi, "").trim();
    if (cleanSup.length >= 2) {
      targetSupplier =
        suppliers.find(
          (s) =>
            (s.name || "").includes(cleanSup) ||
            (s.specialty || "").includes(cleanSup) ||
            (s.notes || "").includes(cleanSup)
        ) || null;
    }
  }
  // If ordering lenses and no explicit supplier was forced, pick the item's linked lens supplier (e.g. Essilor & Hoya Partner)
  if (!targetSupplier) {
    const itemSupId = resolvedItems[0]?.supplierDoc?._id || resolvedItems[0]?.supplierDoc;
    if (itemSupId) {
      targetSupplier = suppliers.find((s) => String(s._id) === String(itemSupId)) || null;
    }
  }
  if (!targetSupplier && (isLensOrderHint || resolvedItems.some((i) => i.productType === "lens"))) {
    targetSupplier =
      suppliers.find((s) => /essilor|hoya|نور|عدسات طبية|بصريات وتجهيز/i.test(`${s.name} ${s.notes || ""} ${s.specialty || ""}`)) ||
      suppliers[0];
  }
  if (!targetSupplier) {
    targetSupplier = suppliers[0];
  }

  if (!targetSupplier) {
    return { error: "لم يتم العثور على مورد نشط لإرسال طلب التوريد إليه" };
  }

  const totalUnits = resolvedItems.reduce((acc, it) => acc + it.quantity, 0);
  const totalEstimatedCostEGP = resolvedItems.reduce((acc, it) => acc + it.lineTotal, 0);

  // 3. Create Supply Waterfall Request (for live Supplier Magic Tracking Link `/supplier/supply-request/:token`)
  let waterfallData = null;
  const primaryCatalogItem = resolvedItems.find((it) => it.productId && mongoose.isValidObjectId(it.productId));
  if (primaryCatalogItem) {
    try {
      const orderTitle =
        resolvedItems.length > 1
          ? `أمر توريد مجمع (${resolvedItems.length} أصناف — شاملة جدول مقاسات الجريد SPH×CYL)`
          : primaryCatalogItem.name;

      waterfallData = await supplyWaterfallService.createWaterfallRequest(
        subdomain,
        {
          productId: primaryCatalogItem.productId,
          orderTitle,
          quantity: totalUnits,
          estimatedCost: totalEstimatedCostEGP,
          items: resolvedItems.map((it) => ({
            productId: it.productId,
            name: it.name,
            sku: it.sku,
            quantity: it.quantity,
            unitCost: it.unitCost,
            matrixBreakdown: it.matrixBreakdown || []
          })),
          supplierIds: [targetSupplier._id, ...suppliers.filter((s) => String(s._id) !== String(targetSupplier._id)).map((s) => s._id)],
          notes: notes || `طلب توريد نواقص شامل (${resolvedItems.length} أصناف) عبر المساعد التنفيذي الذكي`
        },
        {
          userId: user?._id || null,
          role: user?.role || "admin",
          fullname: user?.fullname || "المساعد التنفيذي الذكي (AI Copilot)"
        }
      );
    } catch (wfErr) {
      console.warn("[COPILOT_WATERFALL_CREATE_WARN]:", wfErr.message);
    }
  }

  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3005";
  const trackingPortalUrl = waterfallData?.taskUrl || `${baseUrl}/admin/procurement`;
  const adminProcurementUrl = `${baseUrl}/admin/procurement`;
  const waterfallRequestCode = waterfallData?.request?.requestCode || "";

  // 4. Build Concise, Executive Arabic WhatsApp Purchase Order Message (including Tracking Link!)
  const todayStr = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });

  const itemsFormattedList = resolvedItems
    .map(
      (it, idx) =>
        `🔹 ${idx + 1}. ${it.name} — المطلوب: ${it.quantity} وحدة` +
        (it.depletedPowersSummary ? `\n   • عينة مقاسات الدرج: ${it.depletedPowersSummary}` : "")
    )
    .join("\n");

  const fullWhatsAppMessage = [
    `السلام عليكم، السادة / ${targetSupplier.name}`,
    `📦 أمر توريد بضاعة ونواقص (${waterfallRequestCode || todayStr})`,
    `---------------------------------`,
    itemsFormattedList,
    `---------------------------------`,
    `📊 الإجمالي: ${totalUnits} وحدة | التكلفة التقديرية: ${totalEstimatedCostEGP.toLocaleString()} ج.م`,
    `🔗 لعرض جدول مقاسات الدرج الكامل (SPH × CYL) وتأكيد جاهزية التوريد بضغطة زر:`,
    trackingPortalUrl
  ]
    .filter(Boolean)
    .join("\n");

  // 5. Persist Consolidated Reorder in `storeProcurementReorder` & Dispatch WhatsApp
  const reorderResult = await procurementReorderService.dispatchAndRecordSupplierReorder(
    subdomain,
    {
      supplierId: targetSupplier._id,
      supplierName: targetSupplier.name,
      supplierPhone: targetSupplier.phone,
      supplierWhatsapp: targetSupplier.whatsappPhone || targetSupplier.phone,
      items: resolvedItems.map((it) => ({
        productId: it.productId,
        name: it.name,
        quantity: it.quantity,
        unitCost: it.unitCost,
        stockAtOrder: it.currentStock,
        specs: {
          matrixBreakdown: it.matrixBreakdown || []
        }
      })),
      messageText: fullWhatsAppMessage,
      notes: notes || `أمر توريد آلي عبر المساعد التنفيذي الذكي (${waterfallRequestCode})`,
      waterfallRequestCode,
      trackingPortalUrl,
      channel: "whatsapp_direct"
    },
    user
  );

  const reorderCode = reorderResult?.reorder?.reorderCode || "REO-NEW";
  const supplierWhatsappPhone = targetSupplier.whatsappPhone || targetSupplier.phone || "201099887766";
  // Short, clean redirect URL so LLMs and chat UI never print 1,000+ chars of URL-encoded %D8%... strings
  const whatsappDirectUrl = `${baseUrl}/api/procurement-public/whatsapp/${reorderCode}`;

  // 6. Record Audit Log
  try {
    const AuditLog = getAuditLogModel(subdomain);
    await AuditLog.create({
      userId: user?._id || null,
      userName: user?.fullname || "المساعد الذكي (AI Copilot)",
      userRole: user?.role || "admin",
      action: "copilot_create_supply_order",
      actionLabel: "إنشاء طلب توريد نواقص وإرسال واتساب للمورد",
      targetType: "finance",
      targetId: String(reorderResult?.reorder?._id || ""),
      targetCode: reorderCode,
      details: `تم إصدار أمر توريد (${reorderCode} / ${waterfallRequestCode}) للمورد "${targetSupplier.name}" بعدد ${resolvedItems.length} أصناف (${totalUnits} وحدة)`,
      metadata: {
        reorderCode,
        waterfallRequestCode,
        supplierName: targetSupplier.name,
        totalUnits,
        totalEstimatedCostEGP,
        trackingPortalUrl,
        actor: "AI_COPILOT"
      }
    });
  } catch (auditErr) {
    console.warn("[COPILOT_AUDIT_SUPPLY_WARN]:", auditErr.message);
  }

  return {
    success: true,
    message: `تم إنشاء طلب التوريد بنجاح للمورد "${targetSupplier.name}" برقم (${reorderCode}) وكود تتبع (${waterfallRequestCode})`,
    reorderCode,
    waterfallRequestCode,
    supplier: {
      id: String(targetSupplier._id),
      code: targetSupplier.supplierCode,
      name: targetSupplier.name,
      contactPerson: targetSupplier.contactPerson || "",
      phone: targetSupplier.phone,
      whatsappPhone: supplierWhatsappPhone,
      specialty: targetSupplier.specialty || ""
    },
    orderedItems: resolvedItems.map((it) => ({
      productId: String(it.productId || ""),
      name: it.name,
      sku: it.sku,
      currentStock: it.currentStock,
      quantity: it.quantity,
      unitCost: it.unitCost,
      lineTotal: it.lineTotal,
      depletedDrawerSlotsCount: Array.isArray(it.matrixBreakdown) ? it.matrixBreakdown.length : 0,
      depletedPowersSummary: it.depletedPowersSummary || ""
    })),
    itemsCount: resolvedItems.length,
    totalUnits,
    totalEstimatedCostEGP,
    trackingPortalUrl,
    adminProcurementUrl,
    whatsappDirectUrl
  };
}

// ---------------------------------------------------------------------------
// 3. MASTER TOOL DECLARATIONS FOR LLMs (OpenAI/DeepSeek Function Schema)
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "lookupEntity",
      description: "بحث واستعلام فوري وموجز عن أي كيان في النظام (عميل بالاسم أو الهاتف، منتج بالاسم أو الباركود، فاتورة، معمل، فرع). استخدم هذه الأداة أولاً لمعرفة معرفات الكيانات وأرقامها.",
      parameters: {
        type: "object",
        properties: {
          entityType: {
            type: "string",
            enum: ["customer", "product", "order", "lab", "branch", "partner", "supplier"],
            description: "نوع الكيان المراد البحث عنه"
          },
          query: {
            type: "string",
            description: "نص البحث (اسم العميل، رقم الهاتف 010...، رقم الفاتورة، اسم النظارة أو العدسة)"
          },
          limit: {
            type: "number",
            description: "أقصى عدد نتائج مرجعة (افتراضي 5)"
          }
        },
        required: ["entityType", "query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getEntityRelations",
      description: "استرجاع شبكة العلاقات المرتبطة بكيان معين (مثال: طلبات العميل، كشوفات النظر السابقة، أقساطه، أو أسباب الهالك والتالف لمنتج معين، أو تفاصيل ورشات ومعامل طلب معين).",
      parameters: {
        type: "object",
        properties: {
          entityType: {
            type: "string",
            enum: ["customer", "order", "product"],
            description: "نوع الكيان الأساسي"
          },
          entityId: {
            type: "string",
            description: "معرف الكيان (ID) أو رقم الهاتف في حالة العميل، أو رقم الطلب في حالة الفاتورة"
          },
          relation: {
            type: "string",
            description: "العلاقة المطلوبة. للعميل: (orders, prescriptions, installments, returns). للطلب: (workOrders, items, installments). للمنتج: (scrapRecords, returns, salesHistory)."
          }
        },
        required: ["entityType", "entityId", "relation"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getAggregatedMetrics",
      description: "احتساب المؤشرات الإحصائية والتحليلية المجمعة (معدل الإرجاع، معدل التالف، هامش الربح، معدل سداد الأقساط في مواعيدها) سواء لمنتج محدد أو على مستوى المتجر ككل.",
      parameters: {
        type: "object",
        properties: {
          targetType: {
            type: "string",
            enum: ["product", "global"],
            description: "نطاق الاحتساب: product لمنتج محدد، أو global لكامل المتجر"
          },
          targetId: {
            type: "string",
            description: "معرف المنتج (ID) إذا كان targetType هو product"
          },
          periodDays: {
            type: "number",
            description: "الفترة الزمنية بالأيام (مثلاً 7، 30، 90 يوماً)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getTreasurySummary",
      description: "استعراض الوضع المالي والخزينة والنقدية (المبيعات النقدية، مبيعات البطاقات، الأقساط المحصلة، المصروفات التشغيلية، وصافي السيولة التشغيلية).",
      parameters: {
        type: "object",
        properties: {
          periodDays: {
            type: "number",
            description: "عدد الأيام (افتراضي 7 أيام)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "searchCatalogAndInventory",
      description: "بحث متقدم في كتالوج المنتجات والمخزون مع إمكانية الفلترة بالرصيد والأسعار والتصنيف.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "كلمة البحث" },
          category: { type: "string", description: "التصنيف" },
          minStock: { type: "number", description: "الحد الأدنى للرصيد" },
          maxPrice: { type: "number", description: "الحد الأقصى للسعر" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "recordExpense",
      description: "تسجيل قيد مصروف تشغيلي في الخزينة والمالية والرقابة (مثل فواتير الكهرباء، إيجار، أدوات معمل، صيانة، بوفيه، نقل).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "عنوان المصروف وسببه" },
          category: {
            type: "string",
            enum: ["operational", "marketing", "salaries", "rent", "utilities", "tax", "misc"],
            description: "تصنيف المصروف"
          },
          amount: { type: "number", description: "المبلغ بالجنيه المصري" },
          notes: { type: "string", description: "ملاحظات إضافية" }
        },
        required: ["title", "amount"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "createPosSale",
      description: "إنشاء وتنفيذ فاتورة بيع مباشرة (POS) في نقطة البيع وحسم المخزون تلقائياً وإثبات الإيراد والرقابة.",
      parameters: {
        type: "object",
        properties: {
          customerPhone: { type: "string", description: "رقم هاتف العميل" },
          customerName: { type: "string", description: "اسم العميل" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                productId: { type: "string", description: "معرف المنتج (ID)" },
                quantity: { type: "number", description: "الكمية" },
                price: { type: "number", description: "سعر البيع" }
              },
              required: ["productId", "quantity"]
            },
            description: "قائمة المنتجات المباعة"
          },
          paymentMethod: {
            type: "string",
            enum: ["cash", "card", "wallet", "installment"],
            description: "طريقة الدفع"
          },
          paidAmount: { type: "number", description: "المبلغ المدفوع فعلياً" },
          couponCode: { type: "string", description: "كوبون الخصم إن وجد" },
          notes: { type: "string", description: "ملاحظات الفاتورة" }
        },
        required: ["items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "createWorkOrder",
      description: "إصدار وتوجيه أمر شغل (Work Order) إلى معمل أو ورشة لتركيب وتجهيز عدسات أو صيانة لنظارة مرتبطة بفاتورة.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "رقم الفاتورة أو الطلب" },
          labId: { type: "string", description: "معرف المعمل أو الورشة (labId)" },
          expectedDeliveryDate: { type: "string", description: "تاريخ الاستلام المتوقع (ISO date)" },
          notes: { type: "string", description: "تعليمات وتفاصيل التجهيز" }
        },
        required: ["orderId", "labId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "recordCustomerPrescription",
      description: "حفظ وتوثيق قياسات فحص وكشف نظر طبي جديد للعميل في ملفه السريري مع حساب المسافات والانكسار.",
      parameters: {
        type: "object",
        properties: {
          customerPhone: { type: "string", description: "رقم هاتف العميل" },
          customerId: { type: "string", description: "معرف العميل (ID)" },
          doctorName: { type: "string", description: "اسم الطبيب الفاحص" },
          rightEye: {
            type: "object",
            properties: {
              sph: { type: "string" },
              cyl: { type: "string" },
              axis: { type: "string" },
              add: { type: "string" },
              pd: { type: "string" }
            },
            description: "قياسات العين اليمنى (OD)"
          },
          leftEye: {
            type: "object",
            properties: {
              sph: { type: "string" },
              cyl: { type: "string" },
              axis: { type: "string" },
              add: { type: "string" },
              pd: { type: "string" }
            },
            description: "قياسات العين اليسرى (OS)"
          },
          notes: { type: "string", description: "ملاحظات سريرية" }
        },
        required: ["customerPhone"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "listPartnersLedger",
      description: "استعراض قائمة الشركاء وأصحاب المحل، وحصص ملكيتهم، ورأس المال المكتتب، وإجمالي المسحوبات المسجلة لكل شريك ومقارنتها بنسبة الحصة لتفادي النزاعات.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getLowStockAndSuppliers",
      description: "فحص واسترجاع قائمة الأصناف الناقصة أو الحرجة في المخزون وكذلك نواقص درج/مصفوفة مقاسات العدسات (SPH x CYL)، مع قائمة الموردين المعتمدين وبياناتهم.",
      parameters: {
        type: "object",
        properties: {
          threshold: {
            type: "number",
            description: "الحد الأدنى للرصيد لاعتبار الصنف العام ناقصاً (افتراضي 8)"
          },
          productType: {
            type: "string",
            enum: ["all", "lens", "contact_lens", "frame", "sunglass", "accessory"],
            description: "تصفية حسب نوع الصنف: استخدم lens عند السؤال عن العدسات أو درج العدسات، و frame للشنابر والإطارات، أو all للكل"
          },
          onlyMatrixDepleted: {
            type: "boolean",
            description: "ضعها true عندما يسأل المستخدم عن العدسات الناقصة في الدرج أو مصفوفة المقاسات"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "createSupplyOrderAndWhatsApp",
      description: "إنشاء طلب توريد فعلي (Purchase Order & Supply Waterfall Request) بالأصناف أو العدسات الناقصة في الدرج، وتوليد رابط متابعة وتأكيد التوريد المباشر (trackingPortalUrl)، وتجهيز وإرسال رسالة واتساب مباشرة (whatsappDirectUrl) للمورد المختص أو لأول مورد.",
      parameters: {
        type: "object",
        properties: {
          productType: {
            type: "string",
            enum: ["all", "lens", "contact_lens", "frame"],
            description: "نوع الأصناف المطلوب توريدها تلقائياً: ضعها lens إذا طلب المستخدم توريد العدسات الناقصة في الدرج"
          },
          onlyMatrixDepleted: {
            type: "boolean",
            description: "ضعها true إذا طلب المستخدم إصدار طلب توريد للعدسات الناقصة في الدرج لأي نوع عدسات"
          },
          supplierName: {
            type: "string",
            description: "اسم المورد المراد الإرسال إليه (اتركه فارغاً ليختار المورد المختص أو المورد الأول تلقائياً)"
          },
          supplierId: {
            type: "string",
            description: "معرف المورد إن وجد"
          },
          items: {
            type: "array",
            description: "قائمة الأصناف المطلوب توريدها (اتركها فارغة إذا طلب المستخدم توريد الأصناف أو العدسات الناقصة في الدرج تلقائياً)",
            items: {
              type: "object",
              properties: {
                productId: { type: "string", description: "معرف المنتج إن وجد" },
                name: { type: "string", description: "اسم الصنف" },
                quantity: { type: "number", description: "الكمية المطلوبة" }
              }
            }
          },
          defaultQuantity: {
            type: "number",
            description: "الكمية الافتراضية لكل صنف ناقص (افتراضي 15)"
          },
          notes: {
            type: "string",
            description: "ملاحظات إضافية على طلب التوريد"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "recordPartnerWithdrawal",
      description: "تسجيل قيد مسحوبات نقدية لشريك أو صاحب محل من الخزينة وتحديث رصيد مسحوباته في سجل الشركاء والرقابة المالية (يتطلب تأكيد المستخدم إذا لم يتم التأكيد بعد).",
      parameters: {
        type: "object",
        properties: {
          partnerName: { type: "string", description: "اسم الشريك" },
          partnerId: { type: "string", description: "معرف الشريك (ID) إن وجد" },
          amount: { type: "number", description: "مبلغ المسحوبات بالجنيه المصري" },
          notes: { type: "string", description: "بيان أو سبب المسحوبات" },
          confirmed: { type: "boolean", description: "هل تم تأكيد العملية من قبل المستخدم؟" }
        },
        required: ["amount"]
      }
    }
  }
];

// Execution Dispatcher map
const TOOL_MAP = {
  lookupEntity,
  getEntityRelations,
  getAggregatedMetrics,
  getTreasurySummary,
  searchCatalogAndInventory,
  getLowStockAndSuppliers,
  createSupplyOrderAndWhatsApp,
  recordExpense,
  createPosSale,
  createWorkOrder,
  recordCustomerPrescription,
  listPartnersLedger,
  recordPartnerWithdrawal
};

async function executeCopilotTool(toolName, args, context) {
  const handler = TOOL_MAP[toolName];
  if (!handler) {
    return { error: `الأداة غير معروفة: ${toolName}` };
  }
  try {
    return await handler({ ...args, ...context });
  } catch (err) {
    console.error(`[COPILOT_TOOL_ERR (${toolName})]:`, err);
    return { error: `خطأ أثناء تنفيذ الأداة ${toolName}: ${err.message}` };
  }
}

module.exports = {
  TOOL_DEFINITIONS,
  TOOL_MAP,
  executeCopilotTool,
  lookupEntity,
  getEntityRelations,
  getAggregatedMetrics,
  getTreasurySummary,
  searchCatalogAndInventory,
  getLowStockAndSuppliers,
  createSupplyOrderAndWhatsApp,
  recordExpense,
  createPosSale,
  createWorkOrder,
  recordCustomerPrescription,
  listPartnersLedger,
  recordPartnerWithdrawal
};
