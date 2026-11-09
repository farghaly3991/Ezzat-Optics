const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const mongoUri = 'mongodb+srv://farweb2data:farweb2data_3991@farweb2data.3kjihsz.mongodb.net/optics_store_system?retryWrites=true&w=majority&appName=farweb';

async function seedRealisticCustomers() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB for Seeding Realistic Customers...');

  const db = mongoose.connection;
  const Users = db.collection('users');
  const Orders = db.collection('storeorders');

  const mainBranchId = new mongoose.Types.ObjectId('6aea2f35182ee2ed45c98113');
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Products Reference Map
  const P = {
    raybanClassic: { id: '6aea2f3e182ee2ed45c98124', name: 'شمبر رايبان أفياتور كلاسيك - ذهبي (Ray-Ban RB3025)', price: 2450, costPrice: 1500, type: 'frame' },
    lacosteTitanium: { id: '6aea2f42182ee2ed45c98127', name: 'شمبر لاكوست هاف فريم تيتانيوم - رمادي معدني (Lacoste L2840)', price: 1850, costPrice: 1100, type: 'frame' },
    gucciCatEye: { id: '6aea2f47182ee2ed45c9812a', name: 'نظارة غوتشي كات آي حريمي أسيتات فاخر (Gucci GG0010S)', price: 3600, costPrice: 2200, type: 'frame' },
    kidsFlexi: { id: '6aea2f4c182ee2ed45c9812d', name: 'شمبر أطفال سيليكون مرن غير قابل للكسر (Kids Flexi Junior)', price: 650, costPrice: 380, type: 'frame' },
    blueCut156: { id: '6aea2f51182ee2ed45c98130', name: 'زوج عدسات بلو كت حماية شاشات مضغوطة 1.56 (Blue Cut UV420)', price: 450, costPrice: 220, type: 'lens' },
    essilor161: { id: '6aea2f54182ee2ed45c98133', name: 'زوج عدسات إيسيلور كريزال إيزي برو الفرنسية 1.61 (Essilor Crizal)', price: 1400, costPrice: 850, type: 'lens' },
    transitionsGrey: { id: '6aea2f55182ee2ed45c98136', name: 'زوج عدسات فوتوكروميك متغيرة مع الشمس 1.56 (Transitions Grey)', price: 750, costPrice: 420, type: 'lens' },
    progressiveFreeform: { id: '6aea2f58182ee2ed45c98139', name: 'زوج عدسات بروجريسيف تدريجية متعددة البؤر (Progressive FreeForm 1.56)', price: 2200, costPrice: 1300, type: 'lens' },
    freshlookHazel: { id: '6aea2f5b182ee2ed45c9813c', name: 'عدسات لاصقة فريش لوك كولور بليندز شهرية - عسلي (FreshLook Pure Hazel)', price: 380, costPrice: 240, type: 'lens' },
    renuSolution: { id: '6aea2f5f182ee2ed45c9813f', name: 'محلول تعقيم وحفظ العدسات اللاصقة رينو بلس 360 مل (ReNu MultiPlus)', price: 160, costPrice: 105, type: 'accessory' }
  };

  const customersList = [
    {
      fullname: 'م. حسام الدين عبد الرحمن',
      phone: '01011223344',
      email: 'hossam.abdelrahman@dev-corp.com',
      address: '15 شارع مصدق - حي الدقي',
      city: 'الجيزة',
      gender: 'male',
      birthDate: new Date('1989-04-12'),
      checkupPeriodMonths: 12,
      nextCheckupDate: new Date('2027-02-15'), // ساري
      depositBalance: 0,
      prescriptions: [
        {
          date: new Date('2026-02-15'),
          doctorName: 'د. طارق الشناوي (استشاري جراحة العيون)',
          clinicName: 'عيادات النور التخصصية - المهندسين',
          usageType: 'distance',
          rightEye: { sph: '-3.25', cyl: '-0.75', axis: '170', add: '0.00', pd: '32', prism: '', base: '' },
          leftEye: { sph: '-3.50', cyl: '-0.50', axis: '10', add: '0.00', pd: '31.5', prism: '', base: '' },
          ipd: '63.5',
          notes: 'مهندس برمجيات يعاني من إجهاد الشاشات والصداع الرقمي، يوصى بعدسات بلو كت 1.61 مضغوطة.'
        }
      ],
      orders: [
        {
          orderId: 'ORD-OPT-1001',
          date: new Date('2026-02-16'),
          status: 'delivered',
          isLabOrder: true,
          labStatus: 'delivered',
          labDeliveryDate: new Date('2026-02-18'),
          labNotes: 'قص عدسات بلو كت هاف فريم مع شطف ناعم للحافة.',
          items: [
            {
              productId: P.lacosteTitanium.id,
              name: P.lacosteTitanium.name,
              price: P.lacosteTitanium.price,
              costPrice: P.lacosteTitanium.costPrice,
              quantity: 1,
              productType: 'frame',
              frameSpecs: { brand: 'Lacoste', modelCode: 'L2840', color: 'رمادي معدني', size: '54-17-140' }
            },
            {
              productId: P.blueCut156.id,
              name: P.blueCut156.name,
              price: P.blueCut156.price,
              costPrice: P.blueCut156.costPrice,
              quantity: 1,
              productType: 'lens',
              lensSpecs: { eye: 'both', sph: '-3.25', cyl: '-0.75', axis: '170', lensIndex: '1.56', coatings: ['Blue Cut', 'Anti-Reflective'] }
            }
          ],
          payment: { method: 'card', paid: true },
          subtotal: 2300,
          discount: 100,
          total: 2200,
          paidAmount: 2200
        }
      ]
    },
    {
      fullname: 'أ. نرمين فؤاد الشريف',
      phone: '01122334455',
      email: 'nermine.elsharif@luxury-consult.com',
      address: '28 شارع جزيرة العرب - المهندسين',
      city: 'الجيزة',
      gender: 'female',
      birthDate: new Date('1976-09-22'),
      checkupPeriodMonths: 6,
      nextCheckupDate: new Date('2026-12-01'), // قريب
      depositBalance: 500, // عربون 500 تحت الحساب
      prescriptions: [
        {
          date: new Date('2026-06-01'),
          doctorName: 'د. حسام سامي (أستاذ طب وجراحة العيون - قصر العيني)',
          clinicName: 'مستشفى دار العيون - الدقي',
          usageType: 'progressive',
          rightEye: { sph: '+1.75', cyl: '-0.50', axis: '95', add: '+2.25', pd: '30', prism: '', base: '' },
          leftEye: { sph: '+2.00', cyl: '-0.75', axis: '85', add: '+2.25', pd: '30.5', prism: '', base: '' },
          ipd: '60.5',
          notes: 'تحتاج نظارة متعددة البؤر بروجريسيف فري فورم (FreeForm) لمسافات القيادة والقراءة والكمبيوتر مدمجة.'
        },
        {
          date: new Date('2024-11-10'),
          doctorName: 'د. حسام سامي',
          clinicName: 'مستشفى دار العيون',
          usageType: 'progressive',
          rightEye: { sph: '+1.25', cyl: '-0.50', axis: '90', add: '+1.75', pd: '30', prism: '', base: '' },
          leftEye: { sph: '+1.50', cyl: '-0.50', axis: '90', add: '+1.75', pd: '30.5', prism: '', base: '' },
          ipd: '60.5',
          notes: 'كشف قديم للمقارنة وتتبع تغير القراءة (ADD زاد من 1.75 إلى 2.25).'
        }
      ],
      orders: [
        {
          orderId: 'ORD-OPT-1002',
          date: new Date('2026-06-02'),
          status: 'delivered',
          isLabOrder: true,
          labStatus: 'delivered',
          labDeliveryDate: new Date('2026-06-06'),
          labNotes: 'عدسات بروجريسيف فري فورم فرنسية على شمبر غوتشي أسيتات.',
          items: [
            {
              productId: P.gucciCatEye.id,
              name: P.gucciCatEye.name,
              price: P.gucciCatEye.price,
              costPrice: P.gucciCatEye.costPrice,
              quantity: 1,
              productType: 'frame',
              frameSpecs: { brand: 'Gucci', modelCode: 'GG0010S', color: 'أسود هافان ملكي', size: '52-19-145' }
            },
            {
              productId: P.progressiveFreeform.id,
              name: P.progressiveFreeform.name,
              price: P.progressiveFreeform.price,
              costPrice: P.progressiveFreeform.costPrice,
              quantity: 1,
              productType: 'lens',
              lensSpecs: { eye: 'both', sph: '+1.75', cyl: '-0.50', axis: '95', add: '+2.25', lensIndex: '1.56', lensType: 'Progressive FreeForm' }
            }
          ],
          payment: { method: 'card', paid: true },
          subtotal: 5800,
          discount: 300,
          total: 5500,
          paidAmount: 5500
        }
      ]
    },
    {
      fullname: 'د. ماجد وفيق الشاذلي',
      phone: '01233445566',
      email: 'dr.maged.elshazly@alex-med.org',
      address: '74 طريق الجيش - كليوباترا',
      city: 'الإسكندرية',
      gender: 'male',
      birthDate: new Date('1983-01-18'),
      checkupPeriodMonths: 12,
      nextCheckupDate: new Date('2027-04-10'),
      depositBalance: 150, // رصيد عربون باقي
      prescriptions: [
        {
          date: new Date('2026-04-10'),
          doctorName: 'د. خالد جاد (استشاري القرنية وتصحيح الإبصار)',
          clinicName: 'مركز الإسكندرية لطب العيون',
          usageType: 'distance',
          rightEye: { sph: '-4.50', cyl: '0.00', axis: '0', add: '0.00', pd: '31', prism: '', base: '' },
          leftEye: { sph: '-4.25', cyl: '-0.25', axis: '180', add: '0.00', pd: '31', prism: '', base: '' },
          ipd: '62',
          notes: 'طبيب جراح، يرتدي عدسات لاصقة يومية وشهرية ترطيب عالي أثناء العمليات، ومحلول رينو معقم.'
        }
      ],
      orders: [
        {
          orderId: 'ORD-OPT-1003',
          date: new Date('2026-04-12'),
          status: 'delivered',
          isLabOrder: false,
          labStatus: 'not_applicable',
          items: [
            {
              productId: P.freshlookHazel.id,
              name: P.freshlookHazel.name,
              price: P.freshlookHazel.price,
              costPrice: P.freshlookHazel.costPrice,
              quantity: 2,
              productType: 'contact_lens'
            },
            {
              productId: P.renuSolution.id,
              name: P.renuSolution.name,
              price: P.renuSolution.price,
              costPrice: P.renuSolution.costPrice,
              quantity: 2,
              productType: 'accessory'
            }
          ],
          payment: { method: 'card', paid: true },
          subtotal: 1080,
          discount: 80,
          total: 1000,
          paidAmount: 1000
        }
      ]
    },
    {
      fullname: 'عمر ياسر المنشاوي',
      phone: '01099887766',
      email: 'omar.elmenshawy@student-cu.edu.eg',
      address: 'عمارة 12 شارع السودان - الدقي',
      city: 'الجيزة',
      gender: 'male',
      birthDate: new Date('2006-03-15'),
      checkupPeriodMonths: 12,
      nextCheckupDate: new Date('2025-08-10'), // منتهي الصلاحية Overdue لإظهار تنبيه الفحص الدوري
      depositBalance: 0,
      prescriptions: [
        {
          date: new Date('2024-08-10'),
          doctorName: 'د. سامح عبد الفتاح',
          clinicName: 'مستشفى الطلبة - جامعة القاهرة',
          usageType: 'distance',
          rightEye: { sph: '-1.75', cyl: '-1.25', axis: '15', add: '0.00', pd: '29', prism: '', base: '' },
          leftEye: { sph: '-2.00', cyl: '-1.00', axis: '165', add: '0.00', pd: '29.5', prism: '', base: '' },
          ipd: '58.5',
          notes: 'كشف قديم يحتاج إعادة قياس النظر لتكرار الصداع وزغللة القراءة أثناء المذاكرة.'
        }
      ],
      orders: [
        {
          orderId: 'ORD-OPT-1004',
          date: new Date('2024-08-12'),
          status: 'delivered',
          isLabOrder: true,
          labStatus: 'delivered',
          items: [
            {
              productId: P.blueCut156.id,
              name: P.blueCut156.name,
              price: P.blueCut156.price,
              costPrice: P.blueCut156.costPrice,
              quantity: 1,
              productType: 'lens',
              lensSpecs: { eye: 'both', sph: '-1.75', cyl: '-1.25', axis: '15' }
            }
          ],
          payment: { method: 'cash', paid: true },
          subtotal: 450,
          discount: 50,
          total: 400,
          paidAmount: 400
        }
      ]
    },
    {
      fullname: 'داليا إبراهيم سليمان',
      phone: '01155667788',
      email: 'dalia.soliman@fashion-pr.com',
      address: 'فيلا 44 حي الياسمين - التجمع الأول',
      city: 'القاهرة الجديدة',
      gender: 'female',
      birthDate: new Date('1994-07-28'),
      checkupPeriodMonths: 12,
      nextCheckupDate: new Date('2027-01-20'),
      depositBalance: 0,
      prescriptions: [
        {
          date: new Date('2026-01-20'),
          doctorName: 'د. منى زكي (استشاري بصريات وتأهيل بصري)',
          clinicName: 'مركز رويال فيجن للعيون - التجمع',
          usageType: 'distance',
          rightEye: { sph: '-0.75', cyl: '-0.50', axis: '90', add: '0.00', pd: '31', prism: '', base: '' },
          leftEye: { sph: '-0.75', cyl: '-0.50', axis: '90', add: '0.00', pd: '31', prism: '', base: '' },
          ipd: '62',
          notes: 'حساسية ضوء شديدة أثناء قيادة السيارة بالنهار، تفضل عدسات فوتوكروميك رمادي داكن وسريعة التحول.'
        }
      ],
      orders: [
        {
          orderId: 'ORD-OPT-1005',
          date: new Date('2026-01-22'),
          status: 'delivered',
          isLabOrder: true,
          labStatus: 'delivered',
          labDeliveryDate: new Date('2026-01-24'),
          items: [
            {
              productId: P.raybanClassic.id,
              name: P.raybanClassic.name,
              price: P.raybanClassic.price,
              costPrice: P.raybanClassic.costPrice,
              quantity: 1,
              productType: 'frame',
              frameSpecs: { brand: 'Ray-Ban', modelCode: 'RB3025 Aviator', color: 'إطار ذهبي كلاسيك', size: '58-14-135' }
            },
            {
              productId: P.transitionsGrey.id,
              name: P.transitionsGrey.name,
              price: P.transitionsGrey.price,
              costPrice: P.transitionsGrey.costPrice,
              quantity: 1,
              productType: 'lens',
              lensSpecs: { eye: 'both', sph: '-0.75', cyl: '-0.50', axis: '90', lensIndex: '1.56', lensType: 'Transitions Grey Gen8' }
            }
          ],
          payment: { method: 'card', paid: true },
          subtotal: 3200,
          discount: 200,
          total: 3000,
          paidAmount: 3000
        }
      ]
    },
    {
      fullname: 'الحاج كمال رشاد البدري',
      phone: '01288990011',
      email: 'kamal.elbadry@pension-cairo.gov',
      address: '6 شارع القصر العيني - السيدة زينب',
      city: 'القاهرة',
      gender: 'male',
      birthDate: new Date('1955-12-05'),
      checkupPeriodMonths: 6,
      nextCheckupDate: new Date('2026-11-25'), // قريب جداً
      depositBalance: 0,
      prescriptions: [
        {
          date: new Date('2026-05-25'),
          doctorName: 'د. يحيى قاسم (مستشفى العيون الدولي)',
          clinicName: 'مستشفى العيون الدولي - المعادي',
          usageType: 'reading',
          rightEye: { sph: '+2.50', cyl: '0.00', axis: '0', add: '+2.50', pd: '29.5', prism: '', base: '' },
          leftEye: { sph: '+2.50', cyl: '0.00', axis: '0', add: '+2.50', pd: '29.5', prism: '', base: '' },
          ipd: '59',
          notes: 'نظارة قراءة للمصحف والكتب والصحف اليومية، يحتاج شمبر خفيف ومرن ومريح على الأنف.'
        }
      ],
      orders: [
        {
          orderId: 'ORD-OPT-1006',
          date: new Date('2026-05-26'),
          status: 'delivered',
          isLabOrder: true,
          labStatus: 'delivered',
          items: [
            {
              productId: P.lacosteTitanium.id,
              name: P.lacosteTitanium.name,
              price: P.lacosteTitanium.price,
              costPrice: P.lacosteTitanium.costPrice,
              quantity: 1,
              productType: 'frame'
            },
            {
              productId: P.blueCut156.id,
              name: P.blueCut156.name,
              price: P.blueCut156.price,
              costPrice: P.blueCut156.costPrice,
              quantity: 1,
              productType: 'lens',
              lensSpecs: { eye: 'both', sph: '+2.50', cyl: '0.00', axis: '0' }
            }
          ],
          payment: { method: 'cash', paid: true },
          subtotal: 2300,
          discount: 150,
          total: 2150,
          paidAmount: 2150
        }
      ]
    },
    {
      fullname: 'الطفل حمزة طارق رضوان',
      phone: '01044556677',
      email: 'tarek.radwan.father@kids-optics.com',
      address: 'عمارة 19 الحي السابع - مدينة نصر',
      city: 'القاهرة',
      gender: 'male',
      birthDate: new Date('2019-06-14'), // 7 سنوات
      checkupPeriodMonths: 6,
      nextCheckupDate: new Date('2026-11-18'), // مستحق
      depositBalance: 0,
      prescriptions: [
        {
          date: new Date('2026-05-18'),
          doctorName: 'د. إيمان صبري (استشاري طب وجراحة عيون الأطفال والحول)',
          clinicName: 'مركز عيون الأطفال التخصصي - مصر الجديدة',
          usageType: 'distance',
          rightEye: { sph: '+1.00', cyl: '-2.25', axis: '180', add: '0.00', pd: '25.5', prism: '', base: '' },
          leftEye: { sph: '+0.50', cyl: '-2.00', axis: '175', add: '0.00', pd: '26', prism: '', base: '' },
          ipd: '51.5',
          notes: 'حالة كسل عين واستجماتيزم مركب، يوصى بالالتزام الكامل بالنظارة طوال ساعات اليوم مع رباط سيليكون خلفي.'
        }
      ],
      orders: [
        {
          orderId: 'ORD-OPT-1007',
          date: new Date('2026-05-19'),
          status: 'delivered',
          isLabOrder: true,
          labStatus: 'delivered',
          items: [
            {
              productId: P.kidsFlexi.id,
              name: P.kidsFlexi.name,
              price: P.kidsFlexi.price,
              costPrice: P.kidsFlexi.costPrice,
              quantity: 1,
              productType: 'frame',
              frameSpecs: { brand: 'FlexiJunior', modelCode: 'FJ-01', color: 'أزرق طفولي سيليكون مرن', size: '44-15-125' }
            },
            {
              productId: P.blueCut156.id,
              name: P.blueCut156.name,
              price: P.blueCut156.price,
              costPrice: P.blueCut156.costPrice,
              quantity: 1,
              productType: 'lens',
              lensSpecs: { eye: 'both', sph: '+1.00', cyl: '-2.25', axis: '180' }
            }
          ],
          payment: { method: 'cash', paid: true },
          subtotal: 1100,
          discount: 100,
          total: 1000,
          paidAmount: 1000
        }
      ]
    },
    {
      fullname: 'ياسمين شريف القاضي',
      phone: '01177889900',
      email: 'yasmine.elkadi@interior-studio.eg',
      address: '22 شارع الثورة - مصر الجديدة',
      city: 'القاهرة',
      gender: 'female',
      birthDate: new Date('1997-10-10'),
      checkupPeriodMonths: 12,
      nextCheckupDate: new Date('2027-11-04'),
      depositBalance: 0,
      prescriptions: [
        {
          date: new Date('2026-11-03'),
          doctorName: 'د. شريف الهواري (أستاذ جراحة العيون والليزك)',
          clinicName: 'مركز الهواري للعيون - النزهة',
          usageType: 'distance',
          rightEye: { sph: '-1.50', cyl: '-0.50', axis: '180', add: '0.00', pd: '30.5', prism: '', base: '' },
          leftEye: { sph: '-1.25', cyl: '-0.75', axis: '10', add: '0.00', pd: '30', prism: '', base: '' },
          ipd: '60.5',
          notes: 'مهندسة ديكور، تم اختيار عدسات إيسيلور كريزال إيزي برو الفرنسية 1.61 لنقاء الرؤية وسهولة التنظيف.'
        }
      ],
      orders: [
        // Real active in-lab order!
        {
          orderId: 'ORD-OPT-1008',
          date: new Date('2026-11-03T14:30:00Z'),
          status: 'preparing',
          isLabOrder: true,
          labStatus: 'in_lab', // جاري التجهيز في المعمل حالياً
          labDeliveryDate: new Date('2026-11-05T17:00:00Z'), // التسليم غداً
          labNotes: 'جاري تركيب عدسات إيسيلور الفرنسية على شمبر رايبان أفياتور، ضبط السنترة على IPD 60.5 بدقة.',
          items: [
            {
              productId: P.raybanClassic.id,
              name: P.raybanClassic.name,
              price: P.raybanClassic.price,
              costPrice: P.raybanClassic.costPrice,
              quantity: 1,
              productType: 'frame',
              frameSpecs: { brand: 'Ray-Ban', modelCode: 'RB3025 Aviator', color: 'ذهبي كلاسيك', size: '58-14-135' }
            },
            {
              productId: P.essilor161.id,
              name: P.essilor161.name,
              price: P.essilor161.price,
              costPrice: P.essilor161.costPrice,
              quantity: 1,
              productType: 'lens',
              lensSpecs: { eye: 'both', sph: '-1.50', cyl: '-0.50', axis: '180', lensIndex: '1.61', lensType: 'Essilor Crizal Easy Pro' }
            }
          ],
          payment: { method: 'cash', paid: false },
          subtotal: 3850,
          discount: 150,
          total: 3700,
          paidAmount: 2000 // دفعت عربون 2000 ومتبقي 1700 عند الاستلام
        }
      ]
    }
  ];

  for (const c of customersList) {
    let user = await Users.findOne({ phone: c.phone });
    if (!user) {
      const userDoc = {
        fullname: c.fullname,
        phone: c.phone,
        email: c.email,
        password: hashedPassword,
        address: c.address,
        city: c.city,
        gender: c.gender,
        birthDate: c.birthDate,
        checkupPeriodMonths: c.checkupPeriodMonths,
        nextCheckupDate: c.nextCheckupDate,
        depositBalance: c.depositBalance,
        prescriptions: c.prescriptions,
        role: 1,
        branchId: mainBranchId,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const insertResult = await Users.insertOne(userDoc);
      user = { _id: insertResult.insertedId, ...userDoc };
      console.log('Created Realistic Customer Profile:', c.fullname);
    } else {
      await Users.updateOne(
        { _id: user._id },
        {
          $set: {
            fullname: c.fullname,
            email: c.email,
            address: c.address,
            city: c.city,
            gender: c.gender,
            birthDate: c.birthDate,
            checkupPeriodMonths: c.checkupPeriodMonths,
            nextCheckupDate: c.nextCheckupDate,
            depositBalance: c.depositBalance,
            prescriptions: c.prescriptions,
            role: 1,
            branchId: mainBranchId,
            updatedAt: new Date()
          }
        }
      );
      console.log('Updated Realistic Customer Profile:', c.fullname);
    }

    // Now seed realistic orders linked to this customer
    if (c.orders && c.orders.length > 0) {
      for (const ord of c.orders) {
        const existingOrder = await Orders.findOne({ orderId: ord.orderId });
        const rx = c.prescriptions[0];
        const orderDoc = {
          orderId: ord.orderId,
          branchId: mainBranchId,
          userId: user._id,
          customer: {
            name: c.fullname,
            phone: c.phone,
            email: c.email,
            address: c.address,
            city: c.city,
            notes: ord.labNotes || ''
          },
          items: ord.items.map(it => ({
            productId: it.productId,
            name: it.name,
            price: it.price,
            costPrice: it.costPrice,
            quantity: it.quantity,
            productType: it.productType,
            lensSpecs: it.lensSpecs || {},
            frameSpecs: it.frameSpecs || {},
            grossLineTotal: it.price * it.quantity,
            netLineValue: it.price * it.quantity,
            lineCostTotal: it.costPrice * it.quantity
          })),
          isLabOrder: ord.isLabOrder || false,
          labStatus: ord.labStatus || 'not_applicable',
          labDeliveryDate: ord.labDeliveryDate || null,
          labNotes: ord.labNotes || '',
          prescriptionSnapshot: rx ? {
            sphR: rx.rightEye?.sph,
            cylR: rx.rightEye?.cyl,
            axisR: rx.rightEye?.axis,
            addR: rx.rightEye?.add,
            pdR: rx.rightEye?.pd,
            sphL: rx.leftEye?.sph,
            cylL: rx.leftEye?.cyl,
            axisL: rx.leftEye?.axis,
            addL: rx.leftEye?.add,
            pdL: rx.leftEye?.pd,
            ipd: rx.ipd,
            doctorName: rx.doctorName,
            usageType: rx.usageType
          } : null,
          payment: ord.payment,
          subtotal: ord.subtotal,
          discount: ord.discount,
          shipping: 0,
          total: ord.total,
          paidAmount: ord.paidAmount,
          status: ord.status,
          createdAt: ord.date || new Date(),
          updatedAt: new Date()
        };

        if (!existingOrder) {
          await Orders.insertOne(orderDoc);
          console.log(`  -> Inserted Order ${ord.orderId} for ${c.fullname}`);
        } else {
          await Orders.updateOne({ orderId: ord.orderId }, { $set: orderDoc });
          console.log(`  -> Updated Order ${ord.orderId} for ${c.fullname}`);
        }
      }
    }
  }

  // Link orders for older 3 customers as well
  const u1 = await Users.findOne({ phone: '01012345678' });
  const u2 = await Users.findOne({ phone: '01198765432' });
  const u3 = await Users.findOne({ phone: '01234567890' });

  if (u1) {
    await Orders.updateOne(
      { orderId: 'ORD-OPT-1009' },
      {
        $set: {
          orderId: 'ORD-OPT-1009',
          branchId: mainBranchId,
          userId: u1._id,
          customer: { name: u1.fullname, phone: u1.phone, address: u1.address || 'الدقي', city: u1.city || 'الجيزة' },
          items: [{ productId: P.blueCut156.id, name: P.blueCut156.name, price: 450, quantity: 1, productType: 'lens' }],
          payment: { method: 'cash', paid: true },
          total: 450,
          paidAmount: 250,
          status: 'delivered',
          createdAt: new Date('2026-05-15')
        }
      },
      { upsert: true }
    );
  }

  if (u2) {
    await Orders.updateOne(
      { orderId: 'ORD-OPT-1010' },
      {
        $set: {
          orderId: 'ORD-OPT-1010',
          branchId: mainBranchId,
          userId: u2._id,
          customer: { name: u2.fullname, phone: u2.phone, address: u2.address || 'مدينة نصر', city: u2.city || 'القاهرة' },
          items: [
            { productId: P.gucciCatEye.id, name: P.gucciCatEye.name, price: 3600, quantity: 1, productType: 'frame' },
            { productId: P.progressiveFreeform.id, name: P.progressiveFreeform.name, price: 2200, quantity: 1, productType: 'lens' }
          ],
          payment: { method: 'card', paid: true },
          total: 5800,
          paidAmount: 5800,
          status: 'delivered',
          createdAt: new Date('2026-06-16')
        }
      },
      { upsert: true }
    );
  }

  if (u3) {
    await Orders.updateOne(
      { orderId: 'ORD-OPT-1011' },
      {
        $set: {
          orderId: 'ORD-OPT-1011',
          branchId: mainBranchId,
          userId: u3._id,
          customer: { name: u3.fullname, phone: u3.phone, address: u3.address || 'التجمع', city: u3.city || 'القاهرة' },
          items: [{ productId: P.kidsFlexi.id, name: P.kidsFlexi.name, price: 650, quantity: 1, productType: 'frame' }],
          payment: { method: 'cash', paid: true },
          total: 650,
          paidAmount: 650,
          status: 'delivered',
          createdAt: new Date('2026-05-12')
        }
      },
      { upsert: true }
    );
  }

  console.log('Seeding completed successfully!');
  process.exit(0);
}

seedRealisticCustomers().catch((err) => {
  console.error('Error seeding customers:', err);
  process.exit(1);
});
