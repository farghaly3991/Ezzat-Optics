/**
 * Seed Script: Populate Realistic Procurement Shipments, Registered Suppliers & Product Links
 *
 * Populates:
 * 1. 5 diverse Egyptian/regional suppliers across different specialties
 * 2. Assigns existing store products to their corresponding suppliers with reorder thresholds
 * 3. Creates 5 rich supplier shipments across different statuses (received, in_transit, ordered)
 * 4. Records historical purchase lines, payments, overdue tracking, and receiving inventory movements
 */

const mongoose = require("mongoose");
require("dotenv").config({ path: "server/.env" });
const { ensureTenantConnection } = require("../core/database");
const getSupplierModel = require("../modules/finance/procurement/supplierModel");
const getProductModel = require("../modules/products/productModel");
const getSupplierShipmentModel = require("../modules/finance/procurement/supplierShipmentModel");
const {
  createSupplier,
  createSupplierShipment,
  associateProductsWithShipment,
  recordShipmentPayment
} = require("../modules/finance/procurement/procurementService");
const { receiveSupplierShipment } = require("../modules/finance/inventory/inventoryService");

async function seed() {
  const subdomain = "localhost";
  const databaseUrl = process.env.DEFAULT_DB;
  console.log(`Connecting to tenant [${subdomain}]...`);
  const conn = await ensureTenantConnection(subdomain, databaseUrl);

  const Supplier = getSupplierModel(subdomain);
  const Product = getProductModel(subdomain);
  const Shipment = getSupplierShipmentModel(subdomain);

  console.log("=== 1. Creating / Ensuring Suppliers ===");
  const suppliersData = [
    {
      name: "شركة الأهرام للتوزيع والتوكيلات التجارية",
      specialty: "أجهزة ذكية وهواتف واكسسوارات أصلية",
      contactPerson: "م. أحمد الشناوي",
      phone: "01012345678",
      whatsappPhone: "+201012345678",
      email: "supply@alahram-dist.com",
      address: "مبنى 14، القرية الذكية، طريق مصر إسكندرية الصحراوي، الجيزة",
      notes: "الموزع المعتمد للهواتف الذكية والأجهزة اللوحية بضمان محلي شامل 24 شهراً."
    },
    {
      name: "مؤسسة دلتا مصر للأجهزة المنزلية والتكييف",
      specialty: "أنظمة التكييف والأجهزة المنزلية الكبرى",
      contactPerson: "أ. محمود عبد الرحمن",
      phone: "01198765432",
      whatsappPhone: "+201198765432",
      email: "orders@deltamaster-eg.com",
      address: "المنطقة الصناعية الثانية، بلوك 45، العاشر من رمضان، الشرقية",
      notes: "وكيل معتمد لتوريد تكييفات هاير وكاريير وفريش بقطع غيار أصلية ومراكز صيانة معتمدة."
    },
    {
      name: "شركة النيل الدولية لتكنولوجيا الحاسبات والشبكات",
      specialty: "أجهزة لابتوب وشاشات وحواسب أعمال",
      contactPerson: "م. كريم الصاوي",
      phone: "01234567890",
      whatsappPhone: "+201234567890",
      email: "procurement@nile-computers.com",
      address: "28 شارع جامعة الدول العربية، الدور الرابع، المهندسين، الجيزة",
      notes: "استيراد وتوريد حواسب ماك بوك وديل ولينوفو وسيرفرات وحلول الشبكات."
    },
    {
      name: "الشركة السويسرية للصوتيات والأنظمة الذكية",
      specialty: "سماعات رأس احترافية وساعات رياضية ذكية",
      contactPerson: "كابتن شريف عثمان",
      phone: "01555544433",
      whatsappPhone: "+201555544433",
      email: "sales@swiss-audio-eg.com",
      address: "مول العرب، بوابة 3، التجمع التجاري، 6 أكتوبر",
      notes: "الموزع الحصري لسماعات سوني وأبل إيربودز وساعات جارمين المتطورة."
    },
    {
      name: "المركز المصري لتوريدات الإكسسوارات والشواحن",
      specialty: "بنوك طاقة وشواحن سريعة ووصلات GaN",
      contactPerson: "أ. إبراهيم فؤاد",
      phone: "01099887766",
      whatsappPhone: "+201099887766",
      email: "contact@egyptian-chargers.com",
      address: "ش البستان، باب اللوق، وسط البلد، القاهرة",
      notes: "توريد إكسسوارات الهواتف والكيبلات المعتمدة وشهادات الجودة الأوروبية."
    }
  ];

  const suppliersMap = {};
  for (const sData of suppliersData) {
    let existing = await Supplier.findOne({ name: sData.name });
    if (!existing) {
      existing = await createSupplier(subdomain, sData);
      console.log(`+ Created supplier: ${existing.name} (${existing._id})`);
    } else {
      console.log(`= Existing supplier: ${existing.name} (${existing._id})`);
    }
    suppliersMap[sData.name] = existing;
  }

  console.log("\n=== 2. Finding & Linking Products to Suppliers ===");
  const ahramSup = suppliersMap["شركة الأهرام للتوزيع والتوكيلات التجارية"];
  const deltaSup = suppliersMap["مؤسسة دلتا مصر للأجهزة المنزلية والتكييف"];
  const nileSup = suppliersMap["شركة النيل الدولية لتكنولوجيا الحاسبات والشبكات"];
  const swissSup = suppliersMap["الشركة السويسرية للصوتيات والأنظمة الذكية"];
  const egySup = suppliersMap["المركز المصري لتوريدات الإكسسوارات والشواحن"];

  // Fetch candidate products
  const iphone = await Product.findOne({ name: /آيفون 15/i });
  const s24 = await Product.findOne({ name: /سامسونج جالاكسي S24/i });
  const haier1 = await Product.findOne({ name: /تكييف سبليت سمارت UV انفرتر هاير - بارد وساخن - 1.5/i });
  const haier2 = await Product.findOne({ name: /تكييف سبليت سمارت UV انفرتر هاير - بارد وساخن -2.25/i });
  const carrier1 = await Product.findOne({ name: /تكييف سبليت كاريير Optimax بارد بتقنية الانفرتر ديجيتال، 1.5/i });
  const macbook = await Product.findOne({ name: /ماك بوك برو 16/i });
  const dellXps = await Product.findOne({ name: /ديل إكس بي إس/i });
  const sonyHeadphones = await Product.findOne({ name: /سوني WH-1000XM5/i });
  const appleWatch = await Product.findOne({ name: /أبل واتش الترا 2/i });
  const airpodsMax = await Product.findOne({ name: /إيربودز ماكس/i });
  const garmin = await Product.findOne({ name: /جارمين فينيكس/i });

  // Update products with their suppliers, critical thresholds & low stock simulation
  if (iphone && ahramSup) {
    await Product.updateOne(
      { _id: iphone._id },
      {
        $set: {
          supplierId: ahramSup._id,
          criticalStockThreshold: 5,
          reorderQuantity: 15,
          stockCount: 2 // Make it critical stock for realistic alert!
        }
      }
    );
    console.log(`Linked [${iphone.name}] -> ${ahramSup.name} (Critical Stock: 2)`);
  }

  if (s24 && ahramSup) {
    await Product.updateOne(
      { _id: s24._id },
      {
        $set: {
          supplierId: ahramSup._id,
          criticalStockThreshold: 5,
          reorderQuantity: 20
        }
      }
    );
    console.log(`Linked [${s24.name}] -> ${ahramSup.name}`);
  }

  if (haier1 && deltaSup) {
    await Product.updateOne(
      { _id: haier1._id },
      {
        $set: {
          supplierId: deltaSup._id,
          criticalStockThreshold: 4,
          reorderQuantity: 10,
          stockCount: 0 // Out of stock for realistic alert!
        }
      }
    );
    console.log(`Linked [${haier1.name}] -> ${deltaSup.name} (Out of Stock: 0)`);
  }

  if (haier2 && deltaSup) {
    await Product.updateOne(
      { _id: haier2._id },
      {
        $set: {
          supplierId: deltaSup._id,
          criticalStockThreshold: 3,
          reorderQuantity: 8
        }
      }
    );
    console.log(`Linked [${haier2.name}] -> ${deltaSup.name}`);
  }

  if (carrier1 && deltaSup) {
    await Product.updateOne(
      { _id: carrier1._id },
      {
        $set: {
          supplierId: deltaSup._id,
          criticalStockThreshold: 3,
          reorderQuantity: 6
        }
      }
    );
    console.log(`Linked [${carrier1.name}] -> ${deltaSup.name}`);
  }

  if (macbook && nileSup) {
    await Product.updateOne(
      { _id: macbook._id },
      {
        $set: {
          supplierId: nileSup._id,
          criticalStockThreshold: 3,
          reorderQuantity: 5,
          stockCount: 1 // Critical stock!
        }
      }
    );
    console.log(`Linked [${macbook.name}] -> ${nileSup.name} (Critical Stock: 1)`);
  }

  if (dellXps && nileSup) {
    await Product.updateOne(
      { _id: dellXps._id },
      {
        $set: {
          supplierId: nileSup._id,
          criticalStockThreshold: 3,
          reorderQuantity: 5
        }
      }
    );
    console.log(`Linked [${dellXps.name}] -> ${nileSup.name}`);
  }

  if (sonyHeadphones && swissSup) {
    await Product.updateOne(
      { _id: sonyHeadphones._id },
      {
        $set: {
          supplierId: swissSup._id,
          criticalStockThreshold: 5,
          reorderQuantity: 15
        }
      }
    );
    console.log(`Linked [${sonyHeadphones.name}] -> ${swissSup.name}`);
  }

  if (appleWatch && swissSup) {
    await Product.updateOne(
      { _id: appleWatch._id },
      {
        $set: {
          supplierId: swissSup._id,
          criticalStockThreshold: 4,
          reorderQuantity: 10
        }
      }
    );
    console.log(`Linked [${appleWatch.name}] -> ${swissSup.name}`);
  }

  if (airpodsMax && egySup) {
    await Product.updateOne(
      { _id: airpodsMax._id },
      {
        $set: {
          supplierId: egySup._id,
          criticalStockThreshold: 3,
          reorderQuantity: 8
        }
      }
    );
    console.log(`Linked [${airpodsMax.name}] -> ${egySup.name}`);
  }

  if (garmin && egySup) {
    await Product.updateOne(
      { _id: garmin._id },
      {
        $set: {
          supplierId: egySup._id,
          criticalStockThreshold: 3,
          reorderQuantity: 6
        }
      }
    );
    console.log(`Linked [${garmin.name}] -> ${egySup.name}`);
  }

  console.log("\n=== 3. Creating Realistic Supplier Shipments ===");

  // Helper date generators
  const now = new Date();
  const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
  const daysAhead = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  // --------------------------------------------------------------------------
  // Shipment 1: شركة الأهرام — مستلمة (Received) + مدفوعة جزئياً (Partially Paid)
  // --------------------------------------------------------------------------
  console.log("\n-> Creating Shipment 1 (شركة الأهرام)...");
  const shp1Res = await createSupplierShipment(subdomain, {
    referenceId: `SHP-${now.toISOString().slice(0, 10).replace(/-/g, "")}-AHR1`,
    shipmentDate: daysAgo(5),
    supplierId: ahramSup._id,
    supplierName: ahramSup.name,
    supplierPhone: ahramSup.phone,
    supplierEmail: ahramSup.email,
    supplierAddress: ahramSup.address,
    expectedGoodsValue: 720000,
    dueDate: daysAhead(15),
    status: "ordered",
    notes: "شحنة توريد هواتف رائدة دفعة الربع الأخير مع الضمان والاعتماد."
  });
  const shp1Id = shp1Res.shipment?._id || shp1Res._id;

  if (iphone && s24) {
    await associateProductsWithShipment(subdomain, shp1Id, {
      syncProductCostPrice: false,
      lines: [
        {
          productId: iphone._id,
          quantity: 8,
          unitCost: iphone.costPrice || 51000,
          note: "دفعة آيفون 15 برو ماكس تيتانيوم"
        },
        {
          productId: s24._id,
          quantity: 10,
          unitCost: s24.costPrice || 42000,
          note: "دفعة سامسونج S24 ألترا رمادي وأسود"
        }
      ]
    });
  }

  // Receive goods into inventory
  await receiveSupplierShipment(subdomain, shp1Id, {
    receivedAt: daysAgo(3),
    notes: "تم فحص الشحنة واستلام الكراتين بالكامل مطابقة للمواصفات."
  });

  // Record a partial payment of 400,000 EGP
  await recordShipmentPayment(subdomain, shp1Id, {
    amount: 400000,
    paymentDate: daysAgo(2),
    paymentMethod: "bank_transfer",
    referenceNote: "تحويل بنكي رقم CIB-TX-99881 دفعة أولى"
  });
  console.log(`✓ Shipment 1 created & received, partially paid.`);

  // --------------------------------------------------------------------------
  // Shipment 2: مؤسسة دلتا مصر — في الطريق (In Transit) + دفعة مقدمة
  // --------------------------------------------------------------------------
  console.log("\n-> Creating Shipment 2 (مؤسسة دلتا مصر)...");
  const shp2Res = await createSupplierShipment(subdomain, {
    referenceId: `SHP-${now.toISOString().slice(0, 10).replace(/-/g, "")}-DLT2`,
    shipmentDate: daysAgo(2),
    supplierId: deltaSup._id,
    supplierName: deltaSup.name,
    supplierPhone: deltaSup.phone,
    supplierEmail: deltaSup.email,
    supplierAddress: deltaSup.address,
    expectedGoodsValue: 320000,
    dueDate: daysAhead(7),
    status: "in_transit",
    notes: "شحنة تكييفات سمارت انفرتر هاير وكاريير للشهر القادم — خرجت من مصنع العاشر."
  });
  const shp2Id = shp2Res.shipment?._id || shp2Res._id;

  if (haier1 && carrier1) {
    await associateProductsWithShipment(subdomain, shp2Id, {
      syncProductCostPrice: false,
      lines: [
        {
          productId: haier1._id,
          quantity: 6,
          unitCost: haier1.costPrice || 20625,
          note: "تكييف هاير سمارت 1.5 حصان"
        },
        {
          productId: carrier1._id,
          quantity: 5,
          unitCost: carrier1.costPrice || 23250,
          note: "تكييف كاريير أوبتيمكس 1.5 حصان"
        }
      ]
    });
  }

  // Record an advance payment
  await recordShipmentPayment(subdomain, shp2Id, {
    amount: 100000,
    paymentDate: daysAgo(1),
    paymentMethod: "cheque",
    referenceNote: "شيك بنكي مقبول الدفع كعربون توريد"
  });
  console.log(`✓ Shipment 2 created in transit, advance payment recorded.`);

  // --------------------------------------------------------------------------
  // Shipment 3: شركة النيل الدولية للحاسبات — تم الطلب (Ordered) + متأخرة السداد (Overdue!)
  // --------------------------------------------------------------------------
  console.log("\n-> Creating Shipment 3 (شركة النيل الدولية للحاسبات)...");
  const shp3Res = await createSupplierShipment(subdomain, {
    referenceId: `SHP-${now.toISOString().slice(0, 10).replace(/-/g, "")}-NIL3`,
    shipmentDate: daysAgo(12),
    supplierId: nileSup._id,
    supplierName: nileSup.name,
    supplierPhone: nileSup.phone,
    supplierEmail: nileSup.email,
    supplierAddress: nileSup.address,
    expectedGoodsValue: 540000,
    dueDate: daysAgo(2), // Overdue by 2 days!
    status: "ordered",
    notes: "أجهزة ماك بوك برو وديل إكس بي إس مخصصة للمطورين — تنتظر إتمام إجراءات السداد."
  });
  const shp3Id = shp3Res.shipment?._id || shp3Res._id;

  if (macbook && dellXps) {
    await associateProductsWithShipment(subdomain, shp3Id, {
      syncProductCostPrice: false,
      lines: [
        {
          productId: macbook._id,
          quantity: 3,
          unitCost: macbook.costPrice || 98000,
          note: "ماك بوك برو 16 إنش M3 Max"
        },
        {
          productId: dellXps._id,
          quantity: 4,
          unitCost: dellXps.costPrice || 62000,
          note: "ديل XPS 15 بشاشة OLED"
        }
      ]
    });
  }
  console.log(`✓ Shipment 3 created (Ordered & Overdue for testing alerts!).`);

  // --------------------------------------------------------------------------
  // Shipment 4: الشركة السويسرية للصوتيات — مستلمة بالكامل (Received) + مسددة بالكامل (Paid)
  // --------------------------------------------------------------------------
  console.log("\n-> Creating Shipment 4 (الشركة السويسرية للصوتيات)...");
  const shp4Res = await createSupplierShipment(subdomain, {
    referenceId: `SHP-${now.toISOString().slice(0, 10).replace(/-/g, "")}-SWS4`,
    shipmentDate: daysAgo(18),
    supplierId: swissSup._id,
    supplierName: swissSup.name,
    supplierPhone: swissSup.phone,
    supplierEmail: swissSup.email,
    supplierAddress: swissSup.address,
    expectedGoodsValue: 350000,
    dueDate: daysAgo(5),
    status: "ordered",
    notes: "سماعات سوني عازلة للضوضاء وساعات أبل الترا 2 مع ضمان سويسري حصري."
  });
  const shp4Id = shp4Res.shipment?._id || shp4Res._id;

  if (sonyHeadphones && appleWatch) {
    await associateProductsWithShipment(subdomain, shp4Id, {
      syncProductCostPrice: false,
      lines: [
        {
          productId: sonyHeadphones._id,
          quantity: 15,
          unitCost: sonyHeadphones.costPrice || 7000,
          note: "سماعات سوني WH-1000XM5 أسود وفضي"
        },
        {
          productId: appleWatch._id,
          quantity: 8,
          unitCost: appleWatch.costPrice || 28000,
          note: "أبل واتش ألترا 2 تيتانيوم"
        }
      ]
    });
  }

  // Receive goods
  await receiveSupplierShipment(subdomain, shp4Id, {
    receivedAt: daysAgo(14),
    notes: "تم فحص كافة الأرقام التسلسلية والتأكد من سلامة البضاعة."
  });

  // Re-fetch shipment to get exact line total for full payment
  const freshShp4 = await Shipment.findById(shp4Id);
  const totalToPay = freshShp4.approvedObligationTotal || 329000;

  // Pay in full
  await recordShipmentPayment(subdomain, shp4Id, {
    amount: totalToPay,
    paymentDate: daysAgo(10),
    paymentMethod: "bank_transfer",
    referenceNote: "سداد كامل الالتزام عبر سويفت بنك مصر"
  });
  console.log(`✓ Shipment 4 created, received and fully paid (${totalToPay} EGP).`);

  // --------------------------------------------------------------------------
  // Shipment 5: المركز المصري للإكسسوارات — طلبية جديدة (Ordered)
  // --------------------------------------------------------------------------
  console.log("\n-> Creating Shipment 5 (المركز المصري للإكسسوارات)...");
  const shp5Res = await createSupplierShipment(subdomain, {
    referenceId: `SHP-${now.toISOString().slice(0, 10).replace(/-/g, "")}-EGY5`,
    shipmentDate: now,
    supplierId: egySup._id,
    supplierName: egySup.name,
    supplierPhone: egySup.phone,
    supplierEmail: egySup.email,
    supplierAddress: egySup.address,
    expectedGoodsValue: 250000,
    dueDate: daysAhead(21),
    status: "ordered",
    notes: "توريدات جديدة لسماعات إيربودز ماكس وساعات جارمين الرياضية."
  });
  const shp5Id = shp5Res.shipment?._id || shp5Res._id;

  if (airpodsMax && garmin) {
    await associateProductsWithShipment(subdomain, shp5Id, {
      syncProductCostPrice: false,
      lines: [
        {
          productId: airpodsMax._id,
          quantity: 5,
          unitCost: airpodsMax.costPrice || 19500,
          note: "إيربودز ماكس سبيس جراي"
        },
        {
          productId: garmin._id,
          quantity: 4,
          unitCost: garmin.costPrice || 31000,
          note: "ساعات جارمين فينيكس سولار"
        }
      ]
    });
  }
  console.log(`✓ Shipment 5 created as new ordered shipment.`);

  console.log("\n=======================================================");
  console.log("  REALISTIC PROCUREMENT DATA SEEDED SUCCESSFULLY!      ");
  console.log("=======================================================");

  await conn.close();
}

seed().catch((err) => {
  console.error("Seeding failed with error:", err);
  process.exit(1);
});
