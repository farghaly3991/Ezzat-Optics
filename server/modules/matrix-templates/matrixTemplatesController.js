const getMatrixTemplateModel = require("./matrixTemplateModel");
const { DEFAULT_SPH_VALUES, DEFAULT_CYL_VALUES } = require("./matrixTemplateModel");

exports.listTemplates = async (req, res, next) => {
  try {
    const MatrixTemplate = getMatrixTemplateModel(req.subdomain);
    let templates = await MatrixTemplate.find().sort({ isDefault: -1, createdAt: 1 }).lean();

    // Auto-seed default templates if empty
    if (!templates || templates.length === 0) {
      const defaultOptics = new MatrixTemplate({
        name: "مصفوفة العدسات الطبية القياسية (SPH x CYL)",
        description: "القالب المعياري لمحلات ومراكز البصريات (درجات النظر من +6 إلى -6 والاستجماتيزم حتى -2.00)",
        industry: "optics",
        isDefault: true,
        axisX: {
          key: "CYL",
          label: "الاستجماتيزم (CYL)",
          unit: "D",
          step: 0.25,
          values: DEFAULT_CYL_VALUES
        },
        axisY: {
          key: "SPH",
          label: "الدرجة الكروية (SPH)",
          unit: "D",
          step: 0.25,
          min: -6,
          max: 6,
          values: DEFAULT_SPH_VALUES
        }
      });
      await defaultOptics.save();

      const defaultApparel = new MatrixTemplate({
        name: "مصفوفة المقاس والألوان (Size x Color)",
        description: "قالب عام للأنشطة التجارية للملابس والأحذية والإكسسوارات الطبية",
        industry: "apparel",
        isDefault: false,
        axisX: {
          key: "Color",
          label: "اللون",
          unit: "",
          step: 1,
          values: ["أسود", "أبيض", "كحلي", "رمادي", "بيج", "بني"]
        },
        axisY: {
          key: "Size",
          label: "المقاس",
          unit: "",
          step: 1,
          values: ["XS", "S", "M", "L", "XL", "2XL", "3XL"]
        }
      });
      await defaultApparel.save();

      templates = await MatrixTemplate.find().sort({ isDefault: -1, createdAt: 1 }).lean();
    }

    res.json({ done: true, templates });
  } catch (err) {
    next(err);
  }
};

exports.getTemplateById = async (req, res, next) => {
  try {
    const MatrixTemplate = getMatrixTemplateModel(req.subdomain);
    const template = await MatrixTemplate.findById(req.params.id).lean();
    if (!template) {
      return res.status(404).json({ error: "قالب المصفوفة غير موجود" });
    }
    res.json({ done: true, template });
  } catch (err) {
    next(err);
  }
};

exports.createTemplate = async (req, res, next) => {
  try {
    const MatrixTemplate = getMatrixTemplateModel(req.subdomain);
    const { name, description, industry, axisX, axisY, isDefault } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "اسم القالب مطلوب" });
    }

    if (isDefault) {
      await MatrixTemplate.updateMany({}, { isDefault: false });
    }

    const template = new MatrixTemplate({
      name: name.trim(),
      description: description || "",
      industry: industry || "optics",
      axisX: axisX || {},
      axisY: axisY || {},
      isDefault: Boolean(isDefault)
    });

    await template.save();
    res.status(201).json({ done: true, template, message: "تم إنشاء قالب المصفوفة بنجاح" });
  } catch (err) {
    next(err);
  }
};

exports.updateTemplate = async (req, res, next) => {
  try {
    const MatrixTemplate = getMatrixTemplateModel(req.subdomain);
    const { name, description, industry, axisX, axisY, isDefault } = req.body;

    if (isDefault) {
      await MatrixTemplate.updateMany({ _id: { $ne: req.params.id } }, { isDefault: false });
    }

    const updated = await MatrixTemplate.findByIdAndUpdate(
      req.params.id,
      {
        ...(name ? { name: name.trim() } : {}),
        description: description ?? "",
        ...(industry ? { industry } : {}),
        ...(axisX ? { axisX } : {}),
        ...(axisY ? { axisY } : {}),
        ...(isDefault !== undefined ? { isDefault: Boolean(isDefault) } : {})
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "قالب المصفوفة غير موجود" });
    }

    res.json({ done: true, template: updated, message: "تم تحديث قالب المصفوفة بنجاح" });
  } catch (err) {
    next(err);
  }
};

exports.deleteTemplate = async (req, res, next) => {
  try {
    const MatrixTemplate = getMatrixTemplateModel(req.subdomain);
    const existing = await MatrixTemplate.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "قالب المصفوفة غير موجود" });
    }
    if (existing.isDefault) {
      return res.status(400).json({ error: "لا يمكن حذف القالب الافتراضي للنظام" });
    }
    await MatrixTemplate.findByIdAndDelete(req.params.id);
    res.json({ done: true, message: "تم حذف قالب المصفوفة بنجاح" });
  } catch (err) {
    next(err);
  }
};
