const mongoose = require('mongoose');
const env = require('../env.json');
const mongoUri = env.localhost.database;

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to Optics MongoDB');

  const catSchema = new mongoose.Schema({}, { strict: false });
  const prodSchema = new mongoose.Schema({}, { strict: false });
  const Cat = mongoose.model('storeCategory', catSchema, 'storecategories');
  const Prod = mongoose.model('storeProduct', prodSchema, 'storeproducts');

  // 1. Update Categories Images & Metadata
  await Cat.updateOne(
    { name: /النظارات والشنابر/i },
    {
      $set: {
        image: 'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800&auto=format&fit=crop&q=80',
        specs: {
          'نوع الإطار': 'نوع الإطار',
          'مادة الإطار': 'مادة الإطار',
          'شكل الإطار': 'شكل الإطار',
          'الفئة': 'الفئة',
          'المقاس': 'المقاس',
          'اللون': 'اللون',
          'الماركة': 'الماركة'
        }
      }
    }
  );

  await Cat.updateOne(
    { name: /العدسات الطبية واللاصقة/i },
    {
      $set: {
        image: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&auto=format&fit=crop&q=80',
        specs: {
          'نوع العدسة': 'نوع العدسة',
          'معامل الانكسار': 'معامل الانكسار',
          'طبقة الحماية': 'طبقة الحماية',
          'المادة': 'المادة المصنعة',
          'الماركة': 'الماركة'
        }
      }
    }
  );

  await Cat.updateOne(
    { name: /إكسسوارات ومستلزمات/i },
    {
      $set: {
        image: 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=800&auto=format&fit=crop&q=80',
        specs: {
          'نوع المستلزم': 'نوع المستلزم',
          'السعة': 'السعة / الحجم',
          'الماركة': 'الماركة'
        }
      }
    }
  );

  console.log('Updated categories with authentic optics imagery and specification templates.');

  // 2. Update All Products with targeted optics photos and comprehensive specs
  const productsUpdates = [
    {
      barcode: 'RB-3025-GOLD-58',
      images: [
        'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop&q=80'
      ],
      specs: {
        'نوع الإطار': 'كامل (Full-Rim)',
        'شكل الإطار': 'أفياتور (Aviator)',
        'مادة الإطار': 'معدن فائق الجودة',
        'الفئة': 'للجنسين (Unisex)',
        'المقاس': '58-14-135',
        'اللون': 'ذهبي كلاسيكي Gold',
        'الماركة': 'رايبان Ray-Ban'
      }
    },
    {
      barcode: 'LAC-2840-TI-54',
      images: [
        'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800&auto=format&fit=crop&q=80'
      ],
      specs: {
        'نوع الإطار': 'نصف إطار (Semi-Rimless)',
        'شكل الإطار': 'مستطيل عصري (Rectangular)',
        'مادة الإطار': 'تيتانيوم ياباني فائق الخفة',
        'الفئة': 'رجالي (Men)',
        'المقاس': '54-18-140',
        'اللون': 'رمادي معدني تيتانيوم Gunmetal',
        'الماركة': 'لاكوست Lacoste'
      }
    },
    {
      barcode: 'GUC-0010-CAT-52',
      images: [
        'https://images.unsplash.com/photo-1508296695146-257a814070b4?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80'
      ],
      specs: {
        'نوع الإطار': 'كامل (Full-Rim)',
        'شكل الإطار': 'كات آي عيون القطة (Cat-Eye)',
        'مادة الإطار': 'أسيتات إيطالي فاخر Acetate',
        'الفئة': 'حريمي (Women)',
        'المقاس': '52-16-140',
        'اللون': 'أسود ملكي لامع مع تطعيم ذهبي',
        'الماركة': 'غوتشي Gucci'
      }
    },
    {
      barcode: 'KID-FLEX-BLU-46',
      images: [
        'https://images.unsplash.com/photo-1577803645773-f96470509666?w=800&auto=format&fit=crop&q=80'
      ],
      specs: {
        'نوع الإطار': 'كامل مرن ضد الكسر',
        'شكل الإطار': 'بيضاوي مريح للأطفال',
        'مادة الإطار': 'سيليكون طبي مرن TR90',
        'الفئة': 'أطفال (Kids)',
        'المقاس': '46-15-125',
        'اللون': 'أزرق سماوي مع ذراع أصفر',
        'الماركة': 'فليكسي جونيور Flexi'
      }
    },
    {
      barcode: 'LENS-BC-156-STD',
      images: [
        'https://images.unsplash.com/photo-1582142839970-2b9daac8a48b?w=800&auto=format&fit=crop&q=80'
      ],
      specs: {
        'نوع العدسة': 'حماية شاشات وبلو كت (Blue Cut)',
        'معامل الانكسار': '1.56 قياسي مضغوط',
        'طبقة الحماية': 'مانع انعكاس AR + فلتر حماية الضوء الأزرق UV420',
        'المادة': 'CR-39 راتنج بؤري عالي النقاء',
        'الماركة': 'بلو شيلد BlueShield'
      }
    },
    {
      barcode: 'LENS-CRIZAL-161',
      images: [
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80'
      ],
      specs: {
        'نوع العدسة': 'طبية فائقة النقاء والصلابة (Hi-Index)',
        'معامل الانكسار': '1.61 رقيق فائق الأناقة',
        'طبقة الحماية': 'كريزال إيزي برو Crizal Easy Pro (مضاد للخدش والاتساخ والماء)',
        'المادة': 'MR-8 البوليمر البصري المقوى',
        'الماركة': 'إيسيلور الفرنسية Essilor'
      }
    },
    {
      barcode: 'LENS-PHOTO-156-GRY',
      images: [
        'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=800&auto=format&fit=crop&q=80'
      ],
      specs: {
        'نوع العدسة': 'فوتوكروميك متلونة مع الشمس (Photochromic)',
        'معامل الانكسار': '1.56 متوازن',
        'طبقة الحماية': 'طبقة تفاعلية سريعة التحول رمادي داكن + UV400',
        'المادة': 'CR-39 Photochromic Resin',
        'الماركة': 'ترانزيشنز Transitions'
      }
    },
    {
      barcode: 'LENS-PROG-FF-156',
      images: [
        'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=800&auto=format&fit=crop&q=80'
      ],
      specs: {
        'نوع العدسة': 'بروجريسيف تدريجية متعددة البؤر (قراءة وبعد وكمبيوتر)',
        'معامل الانكسار': '1.56 FreeForm Digital HD',
        'طبقة الحماية': 'Super Hydrophobic Multi-Coating',
        'المادة': 'راتنج رقمي عالي الدقة',
        'الماركة': 'فري فورم برو FreeForm Pro'
      }
    },
    {
      barcode: 'CL-FRESH-HAZEL',
      images: [
        'https://images.unsplash.com/photo-1509695503492-4133869d2208?w=800&auto=format&fit=crop&q=80'
      ],
      specs: {
        'نوع العدسة': 'عدسات لاصقة تجميلية ملونة وطبية',
        'اللون': 'عسلي نقي Pure Hazel',
        'مدة الاستخدام': 'شهرية (Monthly 30 Days)',
        'المحتوى المائي': '55% Water Content أكسجين عالي',
        'القطر': '14.5 مم',
        'الماركة': 'فريش لوك FreshLook'
      }
    },
    {
      barcode: 'ACC-RENU-360ML',
      images: [
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=80'
      ],
      specs: {
        'نوع المستلزم': 'محلول تعقيم وتنظيف وترطيب شامل للعدسات',
        'السعة': '360 مل مع عبوة حفظ مجانية',
        'الاستخدام': 'جميع أنواع العدسات اللاصقة اللينة',
        'الماركة': 'بوش آند لومب Bausch + Lomb'
      }
    }
  ];

  for (const upd of productsUpdates) {
    const res = await Prod.updateOne(
      { barcode: upd.barcode },
      {
        $set: {
          images: upd.images,
          specs: upd.specs
        }
      }
    );
    console.log(`Updated ${upd.barcode}: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }

  console.log('ALL OPTICS PRODUCTS & CATEGORIES SUCCESSFULLY UPDATED!');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
