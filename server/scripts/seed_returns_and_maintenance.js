/**
 * Seed realistic Returns (RMA) and Maintenance requests across different orders and statuses.
 */

const mongoose = require("mongoose");
const path = require("path");
const envJson = require("../env.json");

async function seedReturnsAndMaintenance() {
  console.log("=================================================");
  console.log("  Seeding Real-World Returns & Maintenance Data  ");
  console.log("=================================================");

  const baseUri = envJson.localhost?.database;
  if (!baseUri) {
    throw new Error("No database URI configured in env.json");
  }

  const conn = await mongoose.createConnection(baseUri).asPromise();
  console.log("Connected to MongoDB:", conn.name);

  // Collections
  const productsCol = conn.collection("storeproducts");
  const ordersCol = conn.collection("storeorders");
  const returnsCol = conn.collection("storereturnrequests");
  const usersCol = conn.collection("users");

  // 1. Enrich Products with Warranty Details
  console.log("\n1. Enriching Products with Realistic Warranties...");
  const warrantyUpdates = [
    {
      regex: /سوني|WH-1000XM5/i,
      warrantyMonths: 12,
      policy: "ضمان سوني مصر المعتمد لمدة 12 شهراً ضد عيوب الصناعة الإلكترونية والصوتية"
    },
    {
      regex: /أبل واتش|Apple Watch Ultra/i,
      warrantyMonths: 24,
      policy: "ضمان أبل الرسمي لمدة 24 شهراً مع تغطية شاملة للهاردوير ومقاومة الماء"
    },
    {
      regex: /آيفون 15|iPhone 15/i,
      warrantyMonths: 12,
      policy: "ضمان أبل السنوي المعتمد لدى جميع مراكز الخدمة المعتمدة في جمهورية مصر العربية"
    },
    {
      regex: /ماك بوك|MacBook Pro/i,
      warrantyMonths: 24,
      policy: "ضمان أبل وحاسبات العرب لمدة عامين شامل اللوحة الأم والشاشة والبطارية"
    },
    {
      regex: /سامسونج جالاكسي|S24 Ultra/i,
      warrantyMonths: 24,
      policy: "ضمان سامسونج مصر المعتمد لمدة عامين مع دعم مجاني واستبدال قطع الغيار الأصلية"
    },
    {
      regex: /إيربودز ماكس|AirPods Max/i,
      warrantyMonths: 12,
      policy: "ضمان أبل لمدة سنة كاملة على السماعات وعلبة الشحن الذكية"
    },
    {
      regex: /ديل إكس بي إس|Dell XPS/i,
      warrantyMonths: 12,
      policy: "ضمان ديل الرسمي في مصر لمدة 12 شهراً مع خدمة الدعم الفني السريع"
    },
    {
      regex: /جارمين فينيكس|Garmin/i,
      warrantyMonths: 24,
      policy: "ضمان وكيل جارمين المعتمد لمدة 24 شهراً شاملاً المستشعرات ونظام الملاحة GPS"
    }
  ];

  for (const item of warrantyUpdates) {
    const res = await productsCol.updateMany(
      { name: { $regex: item.regex } },
      {
        $set: {
          warrantyPeriodMonths: item.warrantyMonths,
          warrantyPolicy: item.policy
        }
      }
    );
    console.log(`   - Updated products matching ${item.regex}: ${res.modifiedCount} updated.`);
  }

  // 2. Fetch all orders & users
  console.log("\n2. Fetching Delivered Orders & Users...");
  const orders = await ordersCol.find({}).toArray();
  const users = await usersCol.find({}).toArray();
  const userMap = new Map();
  users.forEach((u) => userMap.set(u.email, u));

  // Find delivered orders
  const deliveredOrders = orders.filter((o) => o.status === "delivered");
  console.log(`   Found ${deliveredOrders.length} delivered orders out of ${orders.length} total.`);

  // Enrich order items with warranty fields if missing
  for (const ord of deliveredOrders) {
    let modified = false;
    const enrichedItems = (ord.items || []).map((it) => {
      let months = it.warrantyPeriodMonths || 0;
      let policy = it.warrantyPolicy || "";
      if (!months) {
        if (/سوني|WH-1000XM5/i.test(it.name)) {
          months = 12;
          policy = "ضمان سوني مصر المعتمد لمدة 12 شهراً";
        } else if (/أبل واتش|Apple Watch/i.test(it.name)) {
          months = 24;
          policy = "ضمان أبل المعتمد لمدة سنتين";
        } else if (/آيفون|iPhone/i.test(it.name)) {
          months = 12;
          policy = "ضمان أبل المعتمد لمدة سنة";
        } else if (/ماك بوك|MacBook/i.test(it.name)) {
          months = 24;
          policy = "ضمان أبل وحاسبات العرب لمدة سنتين";
        } else if (/سامسونج|S24/i.test(it.name)) {
          months = 24;
          policy = "ضمان سامسونج مصر لمدة سنتين";
        } else if (/إيربودز|AirPods/i.test(it.name)) {
          months = 12;
          policy = "ضمان أبل لمدة سنة";
        } else if (/جارمين|Garmin/i.test(it.name)) {
          months = 24;
          policy = "ضمان جارمين لمدة سنتين";
        } else {
          months = 12;
          policy = "ضمان المصنع المعتمد لمدة عام";
        }
        modified = true;
      }
      return {
        ...it,
        warrantyPeriodMonths: months,
        warrantyPolicy: policy
      };
    });

    if (modified) {
      await ordersCol.updateOne({ _id: ord._id }, { $set: { items: enrichedItems } });
    }
  }

  // 3. Clear existing returns in this collection to avoid stale duplicates
  await returnsCol.deleteMany({});
  console.log("\n3. Cleaned existing storereturnrequests collection.");

  // Current realistic time anchors
  const now = new Date();
  const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
  const hoursAgo = (h) => new Date(now.getTime() - h * 60 * 60 * 1000);
  const daysAhead = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  // Helper to find order by customer phone or orderNumber
  const findOrder = (predicate) => deliveredOrders.find(predicate) || deliveredOrders[0];

  // 4. Construct Real-World Returns and Maintenance Requests
  console.log("\n4. Building 12 Comprehensive Cases (Returns & Maintenance)...");

  // Orders pool
  const ordSonyAhmed = findOrder((o) => o.customer?.phone === "01099998888" && /سوني/i.test(o.items?.[0]?.name));
  const ordAirpodsSara = findOrder((o) => o.customer?.phone === "01233445566" && /إيربودز/i.test(o.items?.[0]?.name));
  const ordIphoneKhaled = findOrder((o) => o.customer?.phone === "01122334455" && /آيفون/i.test(o.items?.[0]?.name));
  const ordS24Noura = findOrder((o) => o.customer?.phone === "01077889900");
  const ordSonyMariam = findOrder((o) => o.customer?.phone === "01066554433");
  const ordSonyTarek = findOrder((o) => o.customer?.phone === "01555667788");
  const ordMacbookYoussef = findOrder((o) => o.customer?.phone === "01144556677");
  const ordOldAirpodsAhmed = findOrder((o) => o.customer?.phone === "01099998888" && (o.orderNumber === "ORD-3500112233" || o.items?.length > 1));
  const ordOldWatchKhaled = findOrder((o) => o.customer?.phone === "01122334455" && o.orderNumber === "ORD-3800112233");
  const ordOldIphoneMariam = findOrder((o) => o.customer?.phone === "01066554433" && o.orderNumber === "ORD-4100112233");

  const sampleRequests = [
    // -------------------------------------------------------------
    // Case 1: Return - REQUESTED (طلب إرجاع جديد قيد الانتظار)
    // -------------------------------------------------------------
    {
      requestNumber: "RET-202610-1011",
      type: "return",
      orderId: ordSonyAhmed.orderNumber || ordSonyAhmed.orderId || "ORD-9284102941",
      orderMongoId: ordSonyAhmed._id,
      userId: ordSonyAhmed.userId,
      customer: {
        name: ordSonyAhmed.customer.name,
        phone: ordSonyAhmed.customer.phone,
        address: ordSonyAhmed.customer.address,
        city: ordSonyAhmed.customer.city
      },
      items: [
        {
          productId: ordSonyAhmed.items[0]?.productId || "prod_sony_xm5",
          name: ordSonyAhmed.items[0]?.name || "سماعة رأس لاسلكية سوني WH-1000XM5 عازلة للضوضاء",
          price: ordSonyAhmed.items[0]?.price || 9800,
          quantity: 1,
          image: ordSonyAhmed.items[0]?.image || "",
          warrantyPeriodMonths: 12,
          isUnderWarranty: true,
          reason: "اللون غير مناسب ومقاس وسادات الأذن كبير بعض الشيء عن المتوقع",
          condition: "opened"
        }
      ],
      reason: "المنتج بحالته الممتازة ولكن المقاس غير مريح أثناء ارتدائه لفترات طويلة",
      notes: "تم فتح الكرتونة للتجربة فقط لمدة نصف ساعة، وجميع الملحقات والأسلاك سليمة 100%",
      images: [],
      warrantyStatus: "in_warranty",
      warrantyExpiryDate: daysAhead(330),
      isWithinReturnWindow: true,
      status: "requested",
      courier: {
        name: "",
        phone: "",
        trackingReference: "",
        scheduledDate: null
      },
      refund: {
        amount: 9800,
        method: "paymob_online",
        status: "pending",
        transactionId: "TXN_ORD_9284102",
        paymobRefundId: "",
        restocked: false,
        processedAt: null,
        adminNote: ""
      },
      timeline: [
        {
          status: "requested",
          title: "تقديم طلب الاسترجاع",
          note: "قام العميل بتقديم طلب إرجاع للسماعة عبر حسابه داخل مهلة الـ 15 يوماً المقررة",
          at: hoursAgo(6),
          by: "customer"
        }
      ],
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(6)
    },

    // -------------------------------------------------------------
    // Case 2: Return - APPROVED (طلب إرجاع معتمد في انتظار تعيين المندوب)
    // -------------------------------------------------------------
    {
      requestNumber: "RET-202610-1022",
      type: "return",
      orderId: ordAirpodsSara.orderNumber || ordAirpodsSara.orderId || "ORD-7391028456",
      orderMongoId: ordAirpodsSara._id,
      userId: ordAirpodsSara.userId,
      customer: {
        name: ordAirpodsSara.customer.name,
        phone: ordAirpodsSara.customer.phone,
        address: ordAirpodsSara.customer.address,
        city: ordAirpodsSara.customer.city
      },
      items: [
        {
          productId: ordAirpodsSara.items[0]?.productId || "prod_airpods_max",
          name: ordAirpodsSara.items[0]?.name || "سماعة أبل إيربودز ماكس اللاسلكية سبيس جراي",
          price: ordAirpodsSara.items[0]?.price || 24500,
          quantity: 1,
          image: ordAirpodsSara.items[0]?.image || "",
          warrantyPeriodMonths: 12,
          isUnderWarranty: true,
          reason: "المنتج سليم وبالتغليف الأصلي، العميل يرغب في الاسترجاع لشراء لون فضي",
          condition: "new_sealed"
        }
      ],
      reason: "تغيير رأي العميل - الرغبة في طلب لون آخر",
      notes: "العلبة مغلقة تماماً بسيل المصنع (Sealed) ولم تفتح إطلاقاً",
      images: [],
      warrantyStatus: "in_warranty",
      warrantyExpiryDate: daysAhead(340),
      isWithinReturnWindow: true,
      status: "approved",
      courier: {
        name: "",
        phone: "",
        trackingReference: "",
        scheduledDate: null
      },
      refund: {
        amount: 24500,
        method: "paymob_online",
        status: "pending",
        transactionId: "TXN_ORD_7391028",
        paymobRefundId: "",
        restocked: false,
        processedAt: null,
        adminNote: "تم التحقق من صور التغليف والموافقة المبدئية، بانتظار إسناد المندوب"
      },
      timeline: [
        {
          status: "requested",
          title: "تقديم طلب الاسترجاع",
          note: "قدمت العميلة طلباً لإرجاع سماعة AirPods Max المغلفة",
          at: daysAgo(1),
          by: "customer"
        },
        {
          status: "approved",
          title: "الموافقة المبدئية على الطلب",
          note: "تمت مراجعة الفاتورة وحالة المنتج والموافقة على الاسترجاع",
          at: hoursAgo(14),
          by: "admin"
        }
      ],
      createdAt: daysAgo(1),
      updatedAt: hoursAgo(14)
    },

    // -------------------------------------------------------------
    // Case 3: Return - COURIER_ASSIGNED (تم تعيين مندوب الاستلام)
    // -------------------------------------------------------------
    {
      requestNumber: "RET-202610-1033",
      type: "return",
      orderId: ordIphoneKhaled.orderNumber || ordIphoneKhaled.orderId || "ORD-3129485712",
      orderMongoId: ordIphoneKhaled._id,
      userId: ordIphoneKhaled.userId,
      customer: {
        name: ordIphoneKhaled.customer.name,
        phone: ordIphoneKhaled.customer.phone,
        address: ordIphoneKhaled.customer.address,
        city: ordIphoneKhaled.customer.city
      },
      items: [
        {
          productId: ordIphoneKhaled.items[0]?.productId || "prod_iphone_15_pro_max",
          name: ordIphoneKhaled.items[0]?.name || "هاتف أبل آيفون 15 برو ماكس تيتانيوم طبيعي 256GB",
          price: ordIphoneKhaled.items[0]?.price || 59000,
          quantity: 1,
          image: ordIphoneKhaled.items[0]?.image || "",
          warrantyPeriodMonths: 12,
          isUnderWarranty: true,
          reason: "طلب استرجاع الجهاز لترقية السعة التخزينية إلى 512GB",
          condition: "opened"
        }
      ],
      reason: "العميل يرغب في استرداد المبلغ وشراء سعة تخزينية أعلى",
      notes: "الجهاز لم يتم تفعيله على iCloud مع وجود كابل الشحن وجميع الكتيبات",
      images: [],
      warrantyStatus: "in_warranty",
      warrantyExpiryDate: daysAhead(350),
      isWithinReturnWindow: true,
      status: "courier_assigned",
      courier: {
        name: "كابتن إسلام الشناوي",
        phone: "01012345678",
        trackingReference: "EGY-EXP-99214",
        scheduledDate: daysAhead(1)
      },
      refund: {
        amount: 59000,
        method: "paymob_online",
        status: "pending",
        transactionId: "TXN_ORD_3129485",
        paymobRefundId: "",
        restocked: false,
        processedAt: null,
        adminNote: "تم التنسيق مع العميل على موعد الزيارة غداً ما بين 12 ظهراً و 4 عصراً"
      },
      timeline: [
        {
          status: "requested",
          title: "تقديم الطلب",
          note: "تم تقديم طلب الإرجاع عبر الموقع",
          at: daysAgo(2),
          by: "customer"
        },
        {
          status: "approved",
          title: "الموافقة وتأكيد تفاصيل الاستلام",
          note: "تمت مراجعة الطلب والموافقة عليه من قبل خدمة العملاء",
          at: daysAgo(1),
          by: "admin"
        },
        {
          status: "courier_assigned",
          title: "تعيين مندوب الشحن لاستلام الشحنة",
          note: "تم إسناد الشحنة للمندوب إسلام الشناوي (هاتف: 01012345678) ورقم التتبع EGY-EXP-99214",
          at: hoursAgo(4),
          by: "admin"
        }
      ],
      createdAt: daysAgo(2),
      updatedAt: hoursAgo(4)
    },

    // -------------------------------------------------------------
    // Case 4: Return - PICKED_UP (استلم المندوب المرتجع وهو في الطريق)
    // -------------------------------------------------------------
    {
      requestNumber: "RET-202610-1044",
      type: "return",
      orderId: ordS24Noura.orderNumber || ordS24Noura.orderId || "ORD-6677889900",
      orderMongoId: ordS24Noura._id,
      userId: ordS24Noura.userId,
      customer: {
        name: ordS24Noura.customer.name,
        phone: ordS24Noura.customer.phone,
        address: ordS24Noura.customer.address,
        city: ordS24Noura.customer.city
      },
      items: [
        {
          productId: ordS24Noura.items[0]?.productId || "prod_s24_ultra",
          name: ordS24Noura.items[0]?.name || "هاتف سامسونج جالاكسي S24 الترا مع قلم S-Pen ذاكرة 512GB",
          price: ordS24Noura.items[0]?.price || 49500,
          quantity: 1,
          image: ordS24Noura.items[0]?.image || "",
          warrantyPeriodMonths: 24,
          isUnderWarranty: true,
          reason: "شراء مكرر عن طريق الخطأ",
          condition: "new_sealed"
        }
      ],
      reason: "تم استلام هدية مماثلة والعلبة لم تفتح نهائياً",
      notes: "الاستلام من الإسكندرية لوران ونقلها لفرع المستودع الرئيسي بالقاهرة",
      images: [],
      warrantyStatus: "in_warranty",
      warrantyExpiryDate: daysAhead(700),
      isWithinReturnWindow: true,
      status: "picked_up",
      courier: {
        name: "كابتن مصطفى عبد السلام",
        phone: "01234567890",
        trackingReference: "BOSTA-ALX-5541",
        scheduledDate: daysAgo(0)
      },
      refund: {
        amount: 49500,
        method: "paymob_online",
        status: "pending",
        transactionId: "TXN_ORD_6677889",
        paymobRefundId: "",
        restocked: false,
        processedAt: null,
        adminNote: "المندوب استلم الشحنة وفي طريق الشحن لمستودع الفحص بالقاهرة"
      },
      timeline: [
        {
          status: "requested",
          title: "تقديم الطلب",
          note: "قدمت العميلة طلباً للاسترجاع",
          at: daysAgo(3),
          by: "customer"
        },
        {
          status: "approved",
          title: "اعتماد طلب الاسترجاع",
          note: "تم قبول الإرجاع داخل المدة القانونية",
          at: daysAgo(2),
          by: "admin"
        },
        {
          status: "courier_assigned",
          title: "إسناد لمندوب بوسطة بالإسكندرية",
          note: "تم تعيين كابتن مصطفى برقم بوليصة BOSTA-ALX-5541",
          at: daysAgo(1),
          by: "admin"
        },
        {
          status: "picked_up",
          title: "تم الاستلام من العميل بنجاح",
          note: "استلم المندوب الشحنة وبوليصة الاسترجاع موقعة، وجاري النقل لمركز الفحص",
          at: hoursAgo(5),
          by: "courier"
        }
      ],
      createdAt: daysAgo(3),
      updatedAt: hoursAgo(5)
    },

    // -------------------------------------------------------------
    // Case 5: Return - INSPECTED (وصل مركز الفحص وتم فحص الجودة)
    // -------------------------------------------------------------
    {
      requestNumber: "RET-202610-1055",
      type: "return",
      orderId: ordSonyMariam.orderNumber || ordSonyMariam.orderId || "ORD-6001928374",
      orderMongoId: ordSonyMariam._id,
      userId: ordSonyMariam.userId,
      customer: {
        name: ordSonyMariam.customer.name,
        phone: ordSonyMariam.customer.phone,
        address: ordSonyMariam.customer.address,
        city: ordSonyMariam.customer.city
      },
      items: [
        {
          productId: ordSonyMariam.items[1]?.productId || "prod_sony_xm5_mariam",
          name: "سماعة رأس لاسلكية سوني WH-1000XM5 عازلة للضوضاء",
          price: 9800,
          quantity: 1,
          image: ordSonyMariam.items[1]?.image || "",
          warrantyPeriodMonths: 12,
          isUnderWarranty: true,
          reason: "عدم الراحة مع تقنية عزل الضوضاء النشط (ANC)",
          condition: "opened"
        }
      ],
      reason: "الشعور بضغط أذني خفيف عند تفعيل ميزة عزل الضوضاء",
      notes: "السماعة نظيفة تماماً بدون أي علامات استخدام ومعها الحقيبة والكابل الأصلي",
      images: [],
      warrantyStatus: "in_warranty",
      warrantyExpiryDate: daysAhead(320),
      isWithinReturnWindow: true,
      status: "inspected",
      courier: {
        name: "كابتن هاني بركات",
        phone: "01098765432",
        trackingReference: "ARAMEX-GZA-4091",
        scheduledDate: daysAgo(1)
      },
      refund: {
        amount: 9800,
        method: "paymob_online",
        status: "pending",
        transactionId: "TXN_ORD_6001928",
        paymobRefundId: "",
        restocked: false,
        processedAt: null,
        adminNote: "تم الفحص الفني بواسطة قسم الجودة: المنتج سليم ومطابق للمواصفات وجاهز لصرف الريفند"
      },
      timeline: [
        {
          status: "requested",
          title: "تقديم الطلب",
          note: "تم تقديم طلب الإرجاع",
          at: daysAgo(4),
          by: "customer"
        },
        {
          status: "approved",
          title: "الموافقة المبدئية",
          note: "تمت الموافقة المبدئية على الطلب",
          at: daysAgo(3),
          by: "admin"
        },
        {
          status: "courier_assigned",
          title: "تعيين المندوب",
          note: "إسناد الشحنة لكابتن هاني بركات",
          at: daysAgo(2),
          by: "admin"
        },
        {
          status: "picked_up",
          title: "استلام المرتجع",
          note: "تم الاستلام من العميل بالشيخ زايد",
          at: daysAgo(1),
          by: "courier"
        },
        {
          status: "inspected",
          title: "فحص الجودة واكتمال الفحص الفني",
          note: "اجتاز المنتج اختبار الجودة ومطابقة السيريال نمبر، في انتظار تحويل المبلغ للعميل",
          at: hoursAgo(2),
          by: "admin"
        }
      ],
      createdAt: daysAgo(4),
      updatedAt: hoursAgo(2)
    },

    // -------------------------------------------------------------
    // Case 6: Return - REFUNDED (تم استرداد المبلغ وإعادة المنتج للمخزون)
    // -------------------------------------------------------------
    {
      requestNumber: "RET-202610-1066",
      type: "return",
      orderId: ordSonyTarek.orderNumber || ordSonyTarek.orderId || "ORD-1122334400",
      orderMongoId: ordSonyTarek._id,
      userId: ordSonyTarek.userId,
      customer: {
        name: ordSonyTarek.customer.name,
        phone: ordSonyTarek.customer.phone,
        address: ordSonyTarek.customer.address,
        city: ordSonyTarek.customer.city
      },
      items: [
        {
          productId: ordSonyTarek.items[0]?.productId || "prod_sony_xm5_tarek",
          name: ordSonyTarek.items[0]?.name || "سماعة رأس لاسلكية سوني WH-1000XM5 عازلة للضوضاء",
          price: ordSonyTarek.items[0]?.price || 9800,
          quantity: 1,
          image: ordSonyTarek.items[0]?.image || "",
          warrantyPeriodMonths: 12,
          isUnderWarranty: true,
          reason: "تأخر الاستلام عن الموعد الأصلي ورغبة العميل في استرداد أمواله",
          condition: "new_sealed"
        }
      ],
      reason: "تأخر التسليم وطلب الاسترجاع الفوري",
      notes: "تم استرداد المبلغ بالكامل على البطاقة البنكية وإعادة القطعة إلى المستودع",
      images: [],
      warrantyStatus: "in_warranty",
      warrantyExpiryDate: daysAhead(310),
      isWithinReturnWindow: true,
      status: "refunded",
      courier: {
        name: "كابتن سيف الدين محمود",
        phone: "01155443322",
        trackingReference: "VALU-CAI-7811",
        scheduledDate: daysAgo(3)
      },
      refund: {
        amount: 9800,
        method: "paymob_online",
        status: "processed",
        transactionId: "TXN_PAYMOB_91823741",
        paymobRefundId: "REF_PM_88491023",
        restocked: true,
        processedAt: daysAgo(1),
        adminNote: "تمت معالجة الاسترداد بنجاح عبر بوابة Paymob Accept وتمت إضافة الكمية للمخزون (+1)"
      },
      timeline: [
        {
          status: "requested",
          title: "طلب الاسترجاع",
          note: "تم تقديم الطلب من قبل العميل",
          at: daysAgo(6),
          by: "customer"
        },
        {
          status: "approved",
          title: "الموافقة",
          note: "الموافقة على الاسترجاع المباشر",
          at: daysAgo(5),
          by: "admin"
        },
        {
          status: "courier_assigned",
          title: "جدولة الاستلام",
          note: "تعيين المندوب سيف الدين",
          at: daysAgo(4),
          by: "admin"
        },
        {
          status: "picked_up",
          title: "استلام المرتجع",
          note: "تم استلام المنتج بحالة المصنع الجديدة",
          at: daysAgo(3),
          by: "courier"
        },
        {
          status: "inspected",
          title: "اجتياز الفحص",
          note: "مطابقة التغليف وعدم فتح العلبة",
          at: daysAgo(2),
          by: "admin"
        },
        {
          status: "refunded",
          title: "إتمام الاسترداد المالي وإعادة المنتج للمخزون",
          note: "تم تحويل 9,800 ج.م لبطاقة العميل الائتمانية عبر Paymob بنجاح (رقم الإشعار REF_PM_88491023) وإعادة المنتج للمخزون",
          at: daysAgo(1),
          by: "admin"
        }
      ],
      createdAt: daysAgo(6),
      updatedAt: daysAgo(1)
    },

    // -------------------------------------------------------------
    // Case 7: Return - REJECTED (طلب استرجاع مرفوض موثق بالأسباب)
    // -------------------------------------------------------------
    {
      requestNumber: "RET-202610-1077",
      type: "return",
      orderId: ordMacbookYoussef.orderNumber || ordMacbookYoussef.orderId || "ORD-7001122334",
      orderMongoId: ordMacbookYoussef._id,
      userId: ordMacbookYoussef.userId,
      customer: {
        name: ordMacbookYoussef.customer.name,
        phone: ordMacbookYoussef.customer.phone,
        address: ordMacbookYoussef.customer.address,
        city: ordMacbookYoussef.customer.city
      },
      items: [
        {
          productId: ordMacbookYoussef.items[0]?.productId || "prod_macbook_pro_16",
          name: ordMacbookYoussef.items[0]?.name || "لابتوب أبل ماك بوك برو 16 إنش شريحة M3 Max سعة 1TB",
          price: ordMacbookYoussef.items[0]?.price || 118000,
          quantity: 1,
          image: ordMacbookYoussef.items[0]?.image || "",
          warrantyPeriodMonths: 24,
          isUnderWarranty: true,
          reason: "طلب إرجاع لوجود خدش ناتج عن سوء الاستخدام مع انتهاء مهلة الـ 15 يوماً",
          condition: "damaged"
        }
      ],
      reason: "العميل يرغب في الإرجاع بالرغم من انقضاء مهلة الـ 15 يوماً القانونية",
      notes: "تم فحص الصور وتبين وجود خدش سطحي في الغلاف الخارجي للألومنيوم بالإضافة لتخطي مهلة الاسترجاع",
      images: [],
      warrantyStatus: "in_warranty",
      warrantyExpiryDate: daysAhead(680),
      isWithinReturnWindow: false,
      status: "rejected",
      courier: {
        name: "",
        phone: "",
        trackingReference: "",
        scheduledDate: null
      },
      refund: {
        amount: 0,
        method: "none",
        status: "none",
        transactionId: "",
        paymobRefundId: "",
        restocked: false,
        processedAt: null,
        adminNote: "تم رفض طلب الاسترجاع لمخالفته شروط الاسترجاع (وجود كشط وانقضاء المدة). تم توجيه العميل لطلب صيانة وضمان في حال وجود أعطال تقنية."
      },
      timeline: [
        {
          status: "requested",
          title: "تقديم طلب استرجاع متأخر",
          note: "قدم العميل طلباً بعد مرور 23 يوماً من تاريخ الاستلام",
          at: daysAgo(2),
          by: "customer"
        },
        {
          status: "rejected",
          title: "رفض الطلب لعدم مطابقة سياسة الاسترجاع",
          note: "نأسف، تم رفض طلب الاسترجاع لمرور أكثر من 15 يوماً على استلام الطلب ووجود أضرار خارجية غير مصنعية. يمكنك الاستفادة من الصيانة تحت الضمان للأعطال الفنية.",
          at: daysAgo(1),
          by: "admin"
        }
      ],
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1)
    },

    // -------------------------------------------------------------
    // Case 8: Maintenance - REQUESTED (طلب صيانة جديد داخل الضمان)
    // -------------------------------------------------------------
    {
      requestNumber: "MNT-202610-2011",
      type: "maintenance",
      orderId: ordOldAirpodsAhmed.orderNumber || ordOldAirpodsAhmed.orderId || "ORD-3500112233",
      orderMongoId: ordOldAirpodsAhmed._id,
      userId: ordOldAirpodsAhmed.userId,
      customer: {
        name: ordOldAirpodsAhmed.customer.name,
        phone: ordOldAirpodsAhmed.customer.phone,
        address: ordOldAirpodsAhmed.customer.address,
        city: ordOldAirpodsAhmed.customer.city
      },
      items: [
        {
          productId: "prod_airpods_max_mnt",
          name: "سماعة أبل إيربودز ماكس اللاسلكية سبيس جراي",
          price: 24500,
          quantity: 1,
          image: "",
          warrantyPeriodMonths: 12,
          isUnderWarranty: true,
          reason: "السماعة اليمنى تفصل فجأة عند تحريك الرأس وتحتاج إعادة تشغيل دورية",
          condition: "defective"
        }
      ],
      reason: "عطل فني في مستشعر اتجاه الرأس وانقطاع الصوت من الجانب الأيمن",
      notes: "السيريال: H34J909XN. السماعة بحالة ممتازة وبدون أي كسور، تحت ضمان أبل الساري",
      images: [],
      warrantyStatus: "in_warranty",
      warrantyExpiryDate: daysAhead(310),
      isWithinReturnWindow: false,
      status: "requested",
      courier: {
        name: "",
        phone: "",
        trackingReference: "",
        scheduledDate: null
      },
      refund: {
        amount: 0,
        method: "none",
        status: "none",
        transactionId: "",
        paymobRefundId: "",
        restocked: false,
        processedAt: null,
        adminNote: ""
      },
      timeline: [
        {
          status: "requested",
          title: "تسجيل طلب صيانة وضمان",
          note: "سجل العميل طلب صيانة فنية تحت مظلة الضمان المعتمد (12 شهراً)",
          at: hoursAgo(8),
          by: "customer"
        }
      ],
      createdAt: hoursAgo(8),
      updatedAt: hoursAgo(8)
    },

    // -------------------------------------------------------------
    // Case 9: Maintenance - IN_MAINTENANCE (قيد الفحص والإصلاح بالمركز الفني)
    // -------------------------------------------------------------
    {
      requestNumber: "MNT-202610-2022",
      type: "maintenance",
      orderId: ordOldWatchKhaled.orderNumber || ordOldWatchKhaled.orderId || "ORD-3800112233",
      orderMongoId: ordOldWatchKhaled._id,
      userId: ordOldWatchKhaled.userId,
      customer: {
        name: ordOldWatchKhaled.customer.name,
        phone: ordOldWatchKhaled.customer.phone,
        address: ordOldWatchKhaled.customer.address,
        city: ordOldWatchKhaled.customer.city
      },
      items: [
        {
          productId: "prod_apple_watch_ultra_mnt",
          name: "ساعة أبل واتش الترا 2 تيتانيوم مع حزام رياضي",
          price: 34500,
          quantity: 1,
          image: "",
          warrantyPeriodMonths: 24,
          isUnderWarranty: true,
          reason: "زر Action Button البرتقالي الجانبي يعلق أحياناً ولا يستجيب للضغطات السريعة",
          condition: "defective"
        }
      ],
      reason: "ثقل في ارتداد زر الأكشن الجانبي واختبار عزل المياه",
      notes: "الجهاز داخل الضمان (سنتان)، تم استلامه ومعه العلبة والشاحن المغناطيسي الأصلي",
      images: [],
      warrantyStatus: "in_warranty",
      warrantyExpiryDate: daysAhead(670),
      isWithinReturnWindow: false,
      status: "in_maintenance",
      courier: {
        name: "كابتن زياد المرشدي",
        phone: "01033221100",
        trackingReference: "MAINT-EXP-3011",
        scheduledDate: daysAgo(2)
      },
      refund: {
        amount: 0,
        method: "none",
        status: "none",
        transactionId: "",
        paymobRefundId: "",
        restocked: false,
        processedAt: null,
        adminNote: "الساعة حالياً في ورشة الصيانة المعتمدة، المهندس أحمد عاطف يباشر فحص المفتاح والضغط الهيدروليكي"
      },
      timeline: [
        {
          status: "requested",
          title: "تقديم طلب الصيانة",
          note: "قدم العميل شكوى بتعليق زر الأكشن",
          at: daysAgo(5),
          by: "customer"
        },
        {
          status: "approved",
          title: "اعتماد الصيانة المجانية تحت الضمان",
          note: "تم التحقق من سريان الضمان واعتماد الزيارة الفنية",
          at: daysAgo(4),
          by: "admin"
        },
        {
          status: "courier_assigned",
          title: "تعيين مندوب النقل",
          note: "إسناد استلام الساعة للمندوب زياد",
          at: daysAgo(3),
          by: "admin"
        },
        {
          status: "picked_up",
          title: "تم الاستلام من العميل",
          note: "تم استلام الساعة وتوريدها للمختبر",
          at: daysAgo(2),
          by: "courier"
        },
        {
          status: "in_maintenance",
          title: "بدء أعمال الصيانة والاختبارات الفنية",
          note: "الساعة على منصة الصيانة الدقيقة لاستبدال السويتش الميكانيكي الداخلي واختبار عزل الماء والغبار IP6X",
          at: daysAgo(1),
          by: "technician"
        }
      ],
      createdAt: daysAgo(5),
      updatedAt: daysAgo(1)
    },

    // -------------------------------------------------------------
    // Case 10: Maintenance - REPAIRED (تم الإصلاح بنجاح وبانتظار التوصيل)
    // -------------------------------------------------------------
    {
      requestNumber: "MNT-202610-2033",
      type: "maintenance",
      orderId: ordOldIphoneMariam.orderNumber || ordOldIphoneMariam.orderId || "ORD-4100112233",
      orderMongoId: ordOldIphoneMariam._id,
      userId: ordOldIphoneMariam.userId,
      customer: {
        name: ordOldIphoneMariam.customer.name,
        phone: ordOldIphoneMariam.customer.phone,
        address: ordOldIphoneMariam.customer.address,
        city: ordOldIphoneMariam.customer.city
      },
      items: [
        {
          productId: "prod_iphone_15_mariam_mnt",
          name: "هاتف أبل آيفون 15 برو ماكس تيتانيوم طبيعي 256GB",
          price: 59000,
          quantity: 1,
          image: "",
          warrantyPeriodMonths: 12,
          isUnderWarranty: true,
          reason: "سخونة غير معتادة عند الشحن السريع واستنزاف طاقة البطارية",
          condition: "defective"
        }
      ],
      reason: "ارتفاع حرارة منفذ الشحن USB-C وانخفاض كفاءة الشحن",
      notes: "تم فحص اللوحة واستبدال فلاتة الشحن الأصلية بقطعة غيار معتمدة مجاناً تحت مظلة الضمان",
      images: [],
      warrantyStatus: "in_warranty",
      warrantyExpiryDate: daysAhead(315),
      isWithinReturnWindow: false,
      status: "repaired",
      courier: {
        name: "كابتن طه النجار",
        phone: "01277665544",
        trackingReference: "REP-SHIP-8802",
        scheduledDate: daysAhead(1)
      },
      refund: {
        amount: 0,
        method: "none",
        status: "none",
        transactionId: "",
        paymobRefundId: "",
        restocked: false,
        processedAt: null,
        adminNote: "تم إصلاح العطل بنجاح واجتياز فحص Apple Diagnostics بنسبة 100%. جاري التنسيق للتسليم."
      },
      timeline: [
        {
          status: "requested",
          title: "طلب فحص وصيانة",
          note: "شكوى من ارتفاع حرارة الشحن",
          at: daysAgo(7),
          by: "customer"
        },
        {
          status: "approved",
          title: "الموافقة المباشرة",
          note: "قبول الشكوى تحت الضمان",
          at: daysAgo(6),
          by: "admin"
        },
        {
          status: "courier_assigned",
          title: "استلام المندوب",
          note: "تعيين كابتن طه للاستلام",
          at: daysAgo(5),
          by: "admin"
        },
        {
          status: "picked_up",
          title: "استلام الهاتف",
          note: "تم استلام الهاتف ووصوله لقسم الهاردوير",
          at: daysAgo(4),
          by: "courier"
        },
        {
          status: "in_maintenance",
          title: "الفحص واستبدال القطع",
          note: "تم استبدال منفذ الشحن الداخلي ومعايرة استهلاك الطاقة",
          at: daysAgo(2),
          by: "technician"
        },
        {
          status: "repaired",
          title: "اكتمال الإصلاح بنجاح واجتياز الفحص الشامل",
          note: "تم الانتهاء من الإصلاح وتغليف الجهاز بشكل آمن، جاهز لإعادة التسليم للعميلة غداً",
          at: hoursAgo(3),
          by: "technician"
        }
      ],
      createdAt: daysAgo(7),
      updatedAt: hoursAgo(3)
    },

    // -------------------------------------------------------------
    // Case 11: Maintenance - DELIVERED_BACK (تمت الصيانة وإعادة التسليم للعميل)
    // -------------------------------------------------------------
    {
      requestNumber: "MNT-202610-2044",
      type: "maintenance",
      orderId: ordMacbookYoussef.orderNumber || ordMacbookYoussef.orderId || "ORD-7001122334",
      orderMongoId: ordMacbookYoussef._id,
      userId: ordMacbookYoussef.userId,
      customer: {
        name: ordMacbookYoussef.customer.name,
        phone: ordMacbookYoussef.customer.phone,
        address: ordMacbookYoussef.customer.address,
        city: ordMacbookYoussef.customer.city
      },
      items: [
        {
          productId: "prod_macbook_mnt_done",
          name: "لابتوب أبل ماك بوك برو 16 إنش شريحة M3 Max سعة 1TB",
          price: 118000,
          quantity: 1,
          image: "",
          warrantyPeriodMonths: 24,
          isUnderWarranty: true,
          reason: "صوت طنين غير طبيعي من إحدى مراوح التبريد الداخلية عند تشغيل برامج المونتاج الثقيلة",
          condition: "defective"
        }
      ],
      reason: "اهتزاز في مروحة التبريد اليمنى وحاجة للتنظيف وتجديد المعجون الحراري",
      notes: "تمت الصيانة الدورية وتنظيف نظام التبريد الداخلي بالكامل وتسليمه للعميل مع توقيع إشعار الجودة",
      images: [],
      warrantyStatus: "in_warranty",
      warrantyExpiryDate: daysAhead(670),
      isWithinReturnWindow: false,
      status: "delivered_back",
      courier: {
        name: "كابتن وحيد الفخراني",
        phone: "01044332211",
        trackingReference: "DLV-ALX-9002",
        scheduledDate: daysAgo(1)
      },
      refund: {
        amount: 0,
        method: "none",
        status: "none",
        transactionId: "",
        paymobRefundId: "",
        restocked: false,
        processedAt: null,
        adminNote: "تم تسليم الجهاز للعميل بالإسكندرية بعد تجربة الصوت والأداء أمامه والتأكد من رضاه التام"
      },
      timeline: [
        {
          status: "requested",
          title: "تقديم طلب الصيانة",
          note: "شكوى من صوت المروحة",
          at: daysAgo(10),
          by: "customer"
        },
        {
          status: "approved",
          title: "اعتماد الصيانة",
          note: "موافقة الضمان 24 شهر",
          at: daysAgo(9),
          by: "admin"
        },
        {
          status: "courier_assigned",
          title: "تعيين مندوب الشحن",
          note: "مندوب الإسكندرية كابتن وحيد",
          at: daysAgo(8),
          by: "admin"
        },
        {
          status: "picked_up",
          title: "استلام الجهاز",
          note: "استلام اللابتوب مع الكابل والشاحن الأصلي 140W",
          at: daysAgo(7),
          by: "courier"
        },
        {
          status: "in_maintenance",
          title: "تنفيذ الصيانة الفنية",
          note: "استبدال مروحة التبريد الأصلية وتنظيف مجرى الهواء",
          at: daysAgo(4),
          by: "technician"
        },
        {
          status: "repaired",
          title: "اجتياز اختبارات الضغط (Stress Test)",
          note: "تشغيل أقصى طاقة للمعالج وقياس درجات الحرارة والضوضاء، والنتيجة مثالية",
          at: daysAgo(2),
          by: "technician"
        },
        {
          status: "delivered_back",
          title: "تم تسليم الجهاز للعميل بنجاح",
          note: "تم تسليم الجهاز للعميل وتوقيع إشعار الاستلام وضمان استمرار الضمان المتبقي",
          at: daysAgo(1),
          by: "courier"
        }
      ],
      createdAt: daysAgo(10),
      updatedAt: daysAgo(1)
    },

    // -------------------------------------------------------------
    // Case 12: Maintenance - OUT_OF_WARRANTY (طلب صيانة خارج الضمان - كسر شاشة)
    // -------------------------------------------------------------
    {
      requestNumber: "MNT-202610-2055",
      type: "maintenance",
      orderId: ordS24Noura.orderNumber || ordS24Noura.orderId || "ORD-6677889900",
      orderMongoId: ordS24Noura._id,
      userId: ordS24Noura.userId,
      customer: {
        name: ordS24Noura.customer.name,
        phone: ordS24Noura.customer.phone,
        address: ordS24Noura.customer.address,
        city: ordS24Noura.customer.city
      },
      items: [
        {
          productId: "prod_s24_out_warr",
          name: "هاتف سامسونج جالاكسي S24 الترا مع قلم S-Pen ذاكرة 512GB",
          price: 49500,
          quantity: 1,
          image: "",
          warrantyPeriodMonths: 24,
          isUnderWarranty: false,
          reason: "كسر خارجي في زاوية الشاشة إثر سقوط عرضي على الأرض (أضرار ناتجة عن حادث خارج الضمان)",
          condition: "damaged"
        }
      ],
      reason: "كسر في الزجاج الخارجي للشاشة AMOLED مع عمل اللمس الداخلي بشكل طبيعي",
      notes: "تم إرسال مقايسة التكلفة للعميلة بقيمة 6,500 ج.م للشاشة الأصلية والعميلة وافقت على تحمل التكلفة",
      images: [],
      warrantyStatus: "out_of_warranty",
      warrantyExpiryDate: null,
      isWithinReturnWindow: false,
      status: "approved",
      courier: {
        name: "كابتن حازم الجيار",
        phone: "01066778899",
        trackingReference: "OOW-ALX-1199",
        scheduledDate: daysAhead(1)
      },
      refund: {
        amount: 0,
        method: "none",
        status: "none",
        transactionId: "",
        paymobRefundId: "",
        restocked: false,
        processedAt: null,
        adminNote: "تم التواصل هاتفياً مع العميلة وتوضيح أن كسر الشاشة غير مغطى بالضمان المجاني، وتمت الموافقة على المقايسة الصادرة"
      },
      timeline: [
        {
          status: "requested",
          title: "تقديم طلب صيانة (حادث سقوط)",
          note: "سجلت العميلة طلباً لتغيير الشاشة بعد السقوط",
          at: daysAgo(1),
          by: "customer"
        },
        {
          status: "approved",
          title: "الموافقة على طلب الصيانة المدفوعة",
          note: "تمت الموافقة واعتماد تسعيرة الصيانة المدفوعة وإسناد المندوب حازم لاستلام الجهاز",
          at: hoursAgo(5),
          by: "admin"
        }
      ],
      createdAt: daysAgo(1),
      updatedAt: hoursAgo(5)
    }
  ];

  console.log(`\nInserting ${sampleRequests.length} rich records into storereturnrequests...`);
  const insertResult = await returnsCol.insertMany(sampleRequests);
  console.log(`✅ Successfully seeded ${insertResult.insertedCount} returns & maintenance requests!`);

  // Verify counts
  const countReturns = await returnsCol.countDocuments({ type: "return" });
  const countMaintenance = await returnsCol.countDocuments({ type: "maintenance" });
  const countTotal = await returnsCol.countDocuments({});

  console.log("\n=================================================");
  console.log(`  Seeding Complete Summary:`);
  console.log(`  - Total Requests: ${countTotal}`);
  console.log(`  - Return Requests (مرتجعات): ${countReturns}`);
  console.log(`  - Maintenance Requests (صيانة): ${countMaintenance}`);
  console.log("=================================================\n");

  await conn.close();
}

seedReturnsAndMaintenance().catch((err) => {
  console.error("❌ Seeding Error:", err);
  process.exit(1);
});
