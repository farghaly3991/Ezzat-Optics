const getProductsModel = require("../products/productModel");
const getCategoriesModel = require("../categories/categoryModel");

// Comprehensive colloquial synonym dictionary for Egyptian and Arabic commerce
const CATEGORY_SYNONYMS = [
  {
    categoryKeywords: ["هاتف", "هواتف", "موبايل", "موبايلات", "جوال", "تليفون", "ايفون", "آيفون", "سامسونج", "smartphone", "iphone", "phone"],
    matchCategoryNames: ["إلكترونيات وهواتف", "هواتف ذكية", "هواتف", "موبايلات"]
  },
  {
    categoryKeywords: ["شاشة", "شاشات", "تلفزيون", "تليفزيون", "تلفزيونات", "تليفزيونات", "tv", "smart tv", "رسيفر"],
    matchCategoryNames: ["شاشات تلفزيون", "شاشات", "تلفزيونات"]
  },
  {
    categoryKeywords: ["تكييف", "تكييفات", "مكيف", "مكيفات", "سبليت", "انفرتر", "حصان", "شارب", "كاريير", "هاير", "فري استاند", "كونسيلد"],
    matchCategoryNames: ["حائطي", "أجهزة تكييف منزلي ومركزي", "فري استاند", "تكييفات"]
  },
  {
    categoryKeywords: ["لابتوب", "لاب توب", "كمبيوتر", "ماك بوك", "macbook", "laptop"],
    matchCategoryNames: ["أجهزة كمبيوتر ولابتوب", "لابتوب"]
  },
  {
    categoryKeywords: ["ساعة", "ساعات", "smartwatch", "apple watch"],
    matchCategoryNames: ["ساعات وإكسسوارات ذكية"]
  },
  {
    categoryKeywords: ["سماعة", "سماعات", "ايربودز", "airpods", "headphones"],
    matchCategoryNames: ["صوتيات وسماعات"]
  },
  {
    categoryKeywords: ["ثلاجة", "ثلاجات", "ديب فريزر", "فريزر", "فريزرات"],
    matchCategoryNames: ["ثلاجات", "فريزرات"]
  },
  {
    categoryKeywords: ["بوتاجاز", "بوتجاز", "بوتجازات", "مسطح", "بلت ان", "بلت إن", "فرن", "أفران"],
    matchCategoryNames: ["بوتجازات", "بلت إن", "أفران كهربائية"]
  },
  {
    categoryKeywords: ["غسالة", "غسالات"],
    matchCategoryNames: ["غسالات ملابس", "غسالات أطباق"]
  },
  {
    categoryKeywords: ["سخان", "سخانات"],
    matchCategoryNames: ["سخانات"]
  },
  {
    categoryKeywords: ["مروحة", "مراوح"],
    matchCategoryNames: ["مراوح"]
  },
  {
    categoryKeywords: ["مكنسة", "مكانس"],
    matchCategoryNames: ["مكانس تنظيف"]
  },
  {
    categoryKeywords: ["خلاط", "خلاطات", "كبة", "عجان", "مضرب", "محضر طعام"],
    matchCategoryNames: ["خلاطات", "كبة", "محضر طعام", "مضرب بيض وعجانات", "مضرب يدوي"]
  }
];

exports.handleChat = async (req, res, next) => {
  try {
    const { message = "", history = [], compactContext = null, selectedProductIds = [] } = req.body;
    const query = message.trim();

    if (!query) {
      return res.status(400).json({ error: "الرسالة فارغة" });
    }

    const Products = getProductsModel(req.subdomain);
    const Categories = getCategoriesModel(req.subdomain);

    const allCategories = await Categories.find({ active: true }).lean();
    const qLower = query.toLowerCase();

    // 1. Detect Negation (e.g., "مش تليفزيونات", "مش شاشات", "بدون تكييفات")
    const negatedKeywords = [];
    const negationRegex = /(?:مش|مش عايز|بدون|غير|لا اريد|بلا)\s+([\u0600-\u06FFa-zA-Z0-9]+)/g;
    let negMatch;
    while ((negMatch = negationRegex.exec(qLower)) !== null) {
      if (negMatch[1] && negMatch[1].length > 2) {
        negatedKeywords.push(negMatch[1]);
      }
    }

    // 2. Identify Category Match (Semantic synonyms & direct name match)
    let matchedCategories = [];
    let queryWithoutNegation = qLower;
    negatedKeywords.forEach((neg) => {
      queryWithoutNegation = queryWithoutNegation.replace(neg, "");
    });

    // Check synonym map first
    for (const item of CATEGORY_SYNONYMS) {
      const hit = item.categoryKeywords.some((kw) => queryWithoutNegation.includes(kw));
      if (hit) {
        // Find matching categories in DB
        const found = allCategories.filter((c) =>
          item.matchCategoryNames.some((targetName) =>
            c.name.toLowerCase().includes(targetName.toLowerCase()) ||
            targetName.toLowerCase().includes(c.name.toLowerCase())
          )
        );
        if (found.length > 0) {
          matchedCategories.push(...found);
        }
      }
    }

    // Direct match against category names
    if (matchedCategories.length === 0) {
      for (const cat of allCategories) {
        const catName = cat.name.toLowerCase();
        const tokens = catName.split(/\s+/).filter((t) => t.length > 2);
        if (queryWithoutNegation.includes(catName) || tokens.some((t) => queryWithoutNegation.includes(t))) {
          matchedCategories.push(cat);
        }
      }
    }

    // Inherit category from compactContext if not explicitly provided
    if (matchedCategories.length === 0 && compactContext?.lastCategory) {
      const prevCatId = String(compactContext.lastCategory);
      const prevCat = allCategories.find((c) => String(c._id) === prevCatId);
      if (prevCat) {
        matchedCategories.push(prevCat);
      }
    }

    // Deduplicate and prioritize active categories
    const uniqueCategoryMap = new Map();
    matchedCategories.forEach((c) => uniqueCategoryMap.set(String(c._id), c));
    matchedCategories = Array.from(uniqueCategoryMap.values());

    // Expand parent categories to include all active children (e.g. أجهزة تكييف -> حائطي + فري استاند)
    const expandedCategories = [];
    matchedCategories.forEach((cat) => {
      expandedCategories.push(cat);
      const children = allCategories.filter((c) => c.parentId && String(c.parentId) === String(cat._id));
      children.forEach((ch) => expandedCategories.push(ch));
    });
    matchedCategories = Array.from(new Map(expandedCategories.map((c) => [String(c._id), c])).values());

    // 3. Extract Technical Specifications (e.g. 6 حصان, 1.5 حصان, 55 بوصة, 100 لتر)
    let specFilters = [];
    let detectedSpecText = "";

    // A) Horsepower (التكييفات): 1.5, 2.25, 3, 4, 5, 6, 7.5 حصان
    const hpMatch = qLower.match(/(\d+(?:\.\d+)?)\s*(?:حصان|صاحن|hp)/i);
    if (hpMatch) {
      const hpVal = hpMatch[1];
      detectedSpecText = `${hpVal} حصان`;
      specFilters.push({
        type: "hp",
        label: detectedSpecText,
        regex: new RegExp(`${hpVal.replace('.', '\\.')}\\s*حصان|${hpVal.replace('.', '\\.')}hp`, "i")
      });
    }

    // B) Screen & Fan Size (الشاشات والمراوح): 32, 43, 50, 55, 65, 75 بوصة
    const inchMatch = qLower.match(/(\d+)\s*(?:بوصة|بوصه|انش|إنش|inch)/i);
    if (inchMatch) {
      const inchVal = inchMatch[1];
      detectedSpecText = `${inchVal} بوصة`;
      specFilters.push({
        type: "inch",
        label: detectedSpecText,
        regex: new RegExp(`${inchVal}\\s*بوص|${inchVal}\\s*inch|${inchVal}"`, "i")
      });
    }

    // C) Liters & Capacities (الثلاجات، الغلايات، المكانس): 1.5 لتر، 50 لتر
    const literMatch = qLower.match(/(\d+(?:\.\d+)?)\s*(?:لتر|ليتر)/i);
    if (literMatch) {
      const literVal = literMatch[1];
      detectedSpecText = `${literVal} لتر`;
      specFilters.push({
        type: "liter",
        label: detectedSpecText,
        regex: new RegExp(`${literVal.replace('.', '\\.')}\\s*لتر`, "i")
      });
    }

    // 4. Extract Price Constraints (ONLY if not conflicting with horsepower / specs!)
    let minPrice = null;
    let maxPrice = null;

    // Check Range price: "من 10 ل 20 الف" or "بين 15 و 25 الف"
    const rangeMatch = qLower.match(/(?:من|بين)\s*(\d+)\s*(?:ألف|الف|k)?\s*(?:إلى|الي|الى|ل|حتى|و)\s*(\d+)(?:\s*(?:ألف|الف|k))?/i);
    if (rangeMatch) {
      let p1 = Number(rangeMatch[1]);
      let p2 = Number(rangeMatch[2]);
      const hasThousand = rangeMatch[0].includes("ألف") || rangeMatch[0].includes("الف") || rangeMatch[0].includes("k");
      if (hasThousand || p1 < 1000) p1 *= 1000;
      if (hasThousand || p2 < 1000) p2 *= 1000;
      minPrice = Math.min(p1, p2);
      maxPrice = Math.max(p1, p2);
    } else {
      // Check for price query - BUT DO NOT confuse "6 حصان" or "55 بوصة" with price!
      const isSpecOnlyNumber = (num, fullMatch) => {
        if (hpMatch && fullMatch.includes(hpMatch[1])) return true;
        if (inchMatch && fullMatch.includes(inchMatch[1])) return true;
        if (literMatch && fullMatch.includes(literMatch[1])) return true;
        return false;
      };

      const maxPriceMatch = qLower.match(/(?:أقل من|اقل من|تحت|في حدود|بسعر|بحدود|ميزانية|حوالي|أقصى حد)\s*(\d+)(?:\s*(?:ألف|الف|k))?/i);
      if (maxPriceMatch && !isSpecOnlyNumber(maxPriceMatch[1], maxPriceMatch[0])) {
        let num = Number(maxPriceMatch[1]);
        if (maxPriceMatch[0].includes("ألف") || maxPriceMatch[0].includes("الف") || maxPriceMatch[0].includes("k")) {
          num = num * 1000;
        }
        if (num > 0) maxPrice = num;
      } else if (!hpMatch && !inchMatch && !literMatch) {
        // Shorthand price like "طيب 25", "طب ب 25 الف" (Only when NO spec is specified)
        const shorthandPriceMatch = qLower.match(/(?:^|\s)(?:طيب|طب|طب لو|ب|حوالي|معايا|عندي|سعر)?\s*(\d+)(?:\s*(?:ألف|الف|k))?(?:$|\s)/i);
        if (shorthandPriceMatch) {
          let num = Number(shorthandPriceMatch[1]);
          const hasThousandUnit = shorthandPriceMatch[0].includes("ألف") || shorthandPriceMatch[0].includes("الف") || shorthandPriceMatch[0].includes("k");
          if (hasThousandUnit || (num > 0 && num < 1000)) {
            num = num * 1000;
          }
          if (num > 0) maxPrice = num;
        }
      }

      const minPriceMatch = qLower.match(/(?:فوق|أكتر من|اكثر من|أعلى من|اعلى من|بدءا من|يبدأ من)\s*(\d+)(?:\s*(?:ألف|الف|k))?/i);
      if (minPriceMatch && !isSpecOnlyNumber(minPriceMatch[1], minPriceMatch[0])) {
        let num = Number(minPriceMatch[1]);
        if (minPriceMatch[0].includes("ألف") || minPriceMatch[0].includes("الف") || minPriceMatch[0].includes("k")) {
          num = num * 1000;
        }
        if (num > 0) minPrice = num;
      }
    }

    // 5. Construct MongoDB Query
    const mongoQuery = { active: true };

    // Apply category restriction if identified
    if (matchedCategories.length > 0) {
      const catIds = [];
      matchedCategories.forEach((cat) => {
        catIds.push(cat._id);
        const children = allCategories.filter((c) => c.parentId && String(c.parentId) === String(cat._id));
        children.forEach((ch) => catIds.push(ch._id));
      });
      mongoQuery.categoryId = { $in: catIds };
    }

    // Apply price bounds
    if (minPrice > 0 || maxPrice > 0) {
      mongoQuery.price = {};
      if (minPrice > 0) mongoQuery.price.$gte = minPrice;
      if (maxPrice > 0) mongoQuery.price.$lte = maxPrice;
    }

    // Apply Spec filter (Horsepower, Inch, etc.) directly into query
    if (specFilters.length > 0) {
      const specConditions = [];
      specFilters.forEach((sf) => {
        specConditions.push(
          { name: sf.regex },
          { tags: { $in: [sf.regex] } },
          { "specs.spec1": sf.regex },
          { "specs.spec2": sf.regex },
          { "specs.spec3": sf.regex },
          { description: sf.regex }
        );
      });
      mongoQuery.$or = specConditions;
    }

    // Clean tokens for keyword filtering
    const stopWords = ["عايز", "عاوز", "اريد", "أريد", "ابحث", "عن", "محتاج", "ممكن", "وريني", "في", "من", "على", "مع", "أو", "او", "بين", "حدود", "سعر", "جنيه", "جنية", "الف", "ألف", "مش", "بدون", "لا", "هو", "هي", "حصان", "بوصة", "لتر"];
    const cleanTokens = qLower
      .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !stopWords.includes(t) && !negatedKeywords.includes(t) && isNaN(t));

    // If no category and no spec, use text search tokens
    if (matchedCategories.length === 0 && specFilters.length === 0 && cleanTokens.length > 0) {
      const tokenRegexes = cleanTokens.map((t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
      mongoQuery.$or = [
        { name: { $in: tokenRegexes } },
        { tags: { $in: tokenRegexes } },
        { description: { $in: tokenRegexes } }
      ];
    }

    // 6. Query Database
    let results = await Products.find(mongoQuery)
      .populate("categoryId")
      .sort({ price: 1 })
      .limit(8)
      .lean();

    // 7. Intelligent Category-Safe Relaxation
    let isRelaxed = false;
    let relaxationNote = "";

    if (results.length === 0 && matchedCategories.length > 0) {
      // If a specific spec was requested (e.g. 6 حصان) but returned 0 within narrow categories,
      // search across ALL active products for this spec!
      if (specFilters.length > 0) {
        const specRelaxQuery = { active: true, $or: mongoQuery.$or };
        const specMatches = await Products.find(specRelaxQuery)
          .populate("categoryId")
          .sort({ price: 1 })
          .limit(6)
          .lean();

        if (specMatches.length > 0) {
          results = specMatches;
          isRelaxed = true;
          relaxationNote = `إليك الأجهزة المتوفرة بمواصفة **${detectedSpecText}**:`;
        }
      }

      // If still 0, relax price within category
      if (results.length === 0) {
        const catIds = mongoQuery.categoryId;
        const catProducts = await Products.find({ categoryId: catIds, active: true })
          .populate("categoryId")
          .sort({ price: 1 })
          .limit(6)
          .lean();

        if (catProducts.length > 0) {
          results = catProducts;
          isRelaxed = true;
          const lowestPrice = catProducts[0].price;
          const catName = matchedCategories.find(c => c.productsCount > 0)?.name || matchedCategories[0].name;

          if (detectedSpecText) {
            relaxationNote = `عذراً، لم أجد جهازاً بمواصفة **${detectedSpecText}** في قسم «${catName}». إليك الأجهزة المتاحة حالياً في هذا القسم:`;
          } else if (maxPrice && lowestPrice > maxPrice) {
            relaxationNote = `للأسف لا توجد أجهزة في قسم «${catName}» في حدود ${maxPrice.toLocaleString()} ج.م، وتبدأ الأسعار المتاحة من **${lowestPrice.toLocaleString()} ج.م**. إليك أقرب الخيارات:`;
          } else {
            relaxationNote = `إليك الخيارات المتوفرة حالياً في قسم «${catName}»:`;
          }
        }
      }
    }

    // If completely nothing in category or store
    if (results.length === 0) {
      return res.json({
        done: true,
        engine: "standard-schema-filter",
        reply: `عذراً، لم أجد منتجات مطابقة لطلبك بدقة في الوقت الحالي. يمكنك تصفح باقي الأقسام أو تحديد ميزانية ومواصفات أخرى!`,
        matchedProducts: [],
        comparisonProducts: [],
        comparisonIds: [],
        intent: "search",
        suggestedActions: ["أعلى المنتجات تقييماً", "تصفح الكتالوج", "الأكثر مبيعاً"]
      });
    }

    // 7. Check Comparison Intent
    const isCompare = qLower.includes("مقارن") || qLower.includes("قارن") || qLower.includes("الفرق") || qLower.includes("بينهم");

    if (isCompare && results.length >= 2) {
      const p1 = results[0];
      const p2 = results[1];
      const priceDiff = Math.abs((p1.price || 0) - (p2.price || 0));

      const reply = `📊 مقارنة فنية ومباشرة بين **${p1.name}** و **${p2.name}**:

1. **الأسعار:**
   - **${p1.name}**: ${p1.price?.toLocaleString()} ج.م
   - **${p2.name}**: ${p2.price?.toLocaleString()} ج.م (الفارق: ${priceDiff?.toLocaleString()} ج.م).

2. **المواصفات:**
   - **${p1.name}**: ${Object.entries(p1.specs || {}).map(([k, v]) => `${k}: ${v}`).join(" | ") || "مواصفات قياسية"}
   - **${p2.name}**: ${Object.entries(p2.specs || {}).map(([k, v]) => `${k}: ${v}`).join(" | ") || "مواصفات قياسية"}

💡 يمكنك النقر على زر **"فتح المقارنة الشاملة"** أدناه لاستعراض جدول الفروقات الكامل جنباً إلى جنب!`;

      return res.json({
        done: true,
        engine: "standard-schema-filter",
        reply,
        matchedProducts: [p1, p2],
        comparisonProducts: [p1, p2],
        comparisonIds: [String(p1._id), String(p2._id)],
        intent: "compare",
        suggestedActions: ["عرض صفحة المقارنة", "أضف للسلة", "منتجات بديلة"]
      });
    }

    // 8. Normal Search Reply
    let replyText = "";
    if (relaxationNote) {
      replyText = relaxationNote;
    } else if (detectedSpecText) {
      replyText = `وجدت لك ${results.length} من المنتجات المطابقة لمواصفة **${detectedSpecText}**${matchedCategories.length > 0 ? ` في قسم «${matchedCategories[0].name}»` : ""}:`;
    } else if (matchedCategories.length > 0) {
      const topCatName = matchedCategories.find(c => c.productsCount > 0)?.name || matchedCategories[0].name;
      replyText = `وجدت لك ${results.length} من المنتجات المطابقة في قسم «${topCatName}»${maxPrice ? ` بسعر حتى ${maxPrice.toLocaleString()} ج.م` : ""}:`;
    } else {
      replyText = `إليك أفضل ${results.length} منتجات مطابقة لطلبك:`;
    }

    res.json({
      done: true,
      engine: "standard-schema-filter",
      reply: replyText,
      matchedProducts: results,
      comparisonProducts: results.length >= 2 ? results.slice(0, 2) : [],
      comparisonIds: results.length >= 2 ? results.slice(0, 2).map((p) => String(p._id)) : [],
      intent: "search",
      compactContext: {
        lastCategory: matchedCategories[0]?._id || null,
        lastMaxPrice: maxPrice || null
      },
      suggestedActions: [
        results.length >= 2 ? "قارن بين أول خيارين" : "أعلى تقييماً",
        "الأكثر مشاهدة",
        "تصفح الكتالوج"
      ]
    });
  } catch (err) {
    next(err);
  }
};
