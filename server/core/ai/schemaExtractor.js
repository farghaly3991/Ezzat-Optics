const getCategoriesModel = require("../../modules/categories/categoryModel");
const getAdminDataModel = require("../../modules/settings/adminDataModel");

// In-memory cache per tenant with 10 minutes TTL
const schemaCache = {};

async function buildSchemaData(subdomain) {
  const domain = subdomain || "localhost";
  const Categories = getCategoriesModel(domain);

  // Directly fetch all active categories without unwinding or aggregating products
  const categories = await Categories.find({ active: true }).sort({ order: 1, createdAt: 1 }).lean();

  const catMap = {};
  categories.forEach((c) => {
    catMap[String(c._id)] = c;
  });

  const schemaList = categories.map((cat) => {
    let fullName = cat.name;
    if (cat.parentId && catMap[String(cat.parentId)]) {
      fullName = `${catMap[String(cat.parentId)].name} > ${cat.name}`;
    }

    return {
      id: String(cat._id),
      name: cat.name,
      fullName,
      slug: cat.slug || "",
      parentId: cat.parentId ? String(cat.parentId) : null,
      parentName: cat.parentId && catMap[String(cat.parentId)] ? catMap[String(cat.parentId)].name : null,
      specs: cat.specs && typeof cat.specs === "object" ? cat.specs : {},
      tags: Array.isArray(cat.tags) ? cat.tags.filter(Boolean) : []
    };
  });

  // Build clean, clear schema text directly from category specs & tags
  const schemaPromptText = schemaList
    .map((c) => {
      const specsEntries = Object.entries(c.specs).map(([specKey, specLabel]) => {
        return `${specLabel} (${specKey})`;
      });

      const tagsStr = c.tags.join(", ");

      return `- قسم: "${c.fullName}" (ID: "${c.id}", slug: "${c.slug}")
  الاسم: "${c.name}"
  المواصفات (specs): ${specsEntries.length > 0 ? specsEntries.join(" | ") : "لا توجد مواصفات إضافية"}
  الوسوم (tags): [${tagsStr || "عام"}]`;
    })
    .join("\n\n");

  return {
    schemaList,
    schemaPromptText,
    categoriesCount: schemaList.length,
    lastSyncedAt: new Date()
  };
}

exports.getStoreCategorySchema = async (subdomain) => {
  const domain = subdomain || "localhost";
  const now = Date.now();

  // 1. Check in-memory cache
  if (schemaCache[domain] && now - schemaCache[domain].timestamp < 10 * 60 * 1000) {
    return schemaCache[domain].data;
  }

  // 2. Check if saved in adminData
  const AdminData = getAdminDataModel(domain);
  const adminDoc = await AdminData.findOne().lean();

  if (adminDoc?.aiCategorySchema?.schemaPromptText) {
    const result = {
      schemaList: adminDoc.aiCategorySchema.schemaList || [],
      schemaPromptText: adminDoc.aiCategorySchema.schemaPromptText,
      categoriesCount: adminDoc.aiCategorySchema.categoriesCount || 0,
      lastSyncedAt: adminDoc.aiCategorySchema.lastSyncedAt || new Date()
    };

    schemaCache[domain] = { timestamp: now, data: result };
    return result;
  }

  // 3. Fallback: generate and save
  return exports.syncStoreCategorySchema(domain);
};

exports.syncStoreCategorySchema = async (subdomain) => {
  const domain = subdomain || "localhost";
  const built = await buildSchemaData(domain);

  // Save to AdminData for persistent synchronization across restarts
  const AdminData = getAdminDataModel(domain);
  await AdminData.updateOne(
    {},
    {
      $set: {
        aiCategorySchema: {
          schemaPromptText: built.schemaPromptText,
          schemaList: built.schemaList,
          categoriesCount: built.categoriesCount,
          lastSyncedAt: built.lastSyncedAt
        }
      }
    },
    { upsert: true }
  );

  schemaCache[domain] = {
    timestamp: Date.now(),
    data: built
  };

  return built;
};

exports.invalidateSchemaCache = (subdomain) => {
  const domain = subdomain || "localhost";
  delete schemaCache[domain];
};
