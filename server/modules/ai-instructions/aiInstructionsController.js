const {
  listInstructions,
  createInstruction,
  updateInstruction,
  toggleInstructionStatus,
  deleteInstruction,
  resyncInstructionById,
  resyncAllInstructions,
  retrieveRelevantInstructions,
  formatInstructionsForPlannerPrompt
} = require("./aiInstructionService");

exports.list = async (req, res, next) => {
  try {
    const data = await listInstructions(req.subdomain, req.query || {});
    res.json({
      done: true,
      ...data
    });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const instruction = await createInstruction(req.subdomain, req.body || {}, {
      adminData: req.adminData
    });
    res.status(201).json({
      done: true,
      instruction,
      message:
        instruction.syncStatus === "synced"
          ? "تم إنشاء التعليمة ومزامنة المتجه الدلالي بنجاح"
          : "تم حفظ التعليمة ولكن تعذر مزامنة المتجه حالياً (يمكنك إعادة المحاولة)"
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ done: false, error: err.message });
    }
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const instruction = await updateInstruction(req.subdomain, req.params.id, req.body || {}, {
      adminData: req.adminData
    });
    res.json({
      done: true,
      instruction,
      message: "تم تحديث التعليمة ومزامنتها بنجاح"
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ done: false, error: err.message });
    }
    next(err);
  }
};

exports.toggle = async (req, res, next) => {
  try {
    const instruction = await toggleInstructionStatus(
      req.subdomain,
      req.params.id,
      req.body?.active
    );
    res.json({
      done: true,
      instruction,
      message: instruction.active
        ? "تم تفعيل التعليمة وإدراجها في البحث الذكي"
        : "تم تعطيل التعليمة واستبعادها من البحث الذكي"
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ done: false, error: err.message });
    }
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const result = await deleteInstruction(req.subdomain, req.params.id);
    res.json({
      done: true,
      ...result,
      message: "تم حذف التعليمة ومتجهها الدلالي نهائياً"
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ done: false, error: err.message });
    }
    next(err);
  }
};

exports.resyncOne = async (req, res, next) => {
  try {
    const instruction = await resyncInstructionById(req.subdomain, req.params.id, {
      adminData: req.adminData
    });
    res.json({
      done: true,
      instruction,
      message:
        instruction.syncStatus === "synced"
          ? "تمت إعادة توليد ومزامنة المتجه الدلالي بنجاح"
          : `تعذر المزامنة: ${instruction.syncError || "خطأ غير معروف"}`
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ done: false, error: err.message });
    }
    next(err);
  }
};

exports.resyncAll = async (req, res, next) => {
  try {
    const result = await resyncAllInstructions(req.subdomain, {
      onlyUnsynced: Boolean(req.body?.onlyUnsynced),
      adminData: req.adminData
    });
    res.json({
      done: true,
      ...result,
      message: `تمت مزامنة ${result.syncedCount} تعليمة بنجاح من إجمالي ${result.totalProcessed}`
    });
  } catch (err) {
    next(err);
  }
};

exports.testRetrieval = async (req, res, next) => {
  try {
    const { query = "", categoryId = null, productIds = [], minSimilarity, limit } = req.body || {};
    if (!String(query || "").trim()) {
      return res.status(400).json({ done: false, error: "يرجى إدخال جملة بحث لاختبار الاسترجاع" });
    }

    const retrieval = await retrieveRelevantInstructions(req.subdomain, {
      query,
      categoryId,
      selectedProductIds: productIds,
      ...(minSimilarity !== undefined ? { minSimilarity: Number(minSimilarity) } : {}),
      ...(limit !== undefined ? { limit: Number(limit) } : {})
    });

    res.json({
      done: true,
      ...retrieval,
      formattedPromptBlock: formatInstructionsForPlannerPrompt(retrieval.instructions)
    });
  } catch (err) {
    next(err);
  }
};
