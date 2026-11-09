const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '..', 'client', 'src', 'admin', 'products', 'components', 'UnifiedProductForm.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Initial form state
if (!content.includes('branchId: initialBranchId')) {
  content = content.replace(
    /const \[form, setForm\] = useState\(\{[\r\n\s]+name: '',/,
    `const initialBranchId =
    initialData?.branchId?._id ||
    initialData?.branchId ||
    (isBranchAdmin && user?.branchId ? String(user.branchId) : null) ||
    (activeBranchId && activeBranchId !== 'all' ? activeBranchId : null) ||
    (branches[0]?._id ? String(branches[0]._id) : '');

  const [form, setForm] = useState({
    branchId: initialBranchId,
    name: '',`
  );
}

// 2. Sync initialData
if (!content.includes('initialData.branchId')) {
  content = content.replace(
    /if \(initialData\) \{[\r\n\s]+setForm\(\{[\r\n\s]+name: initialData\.name \|\| '',/,
    `if (initialData) {
      setForm({
        branchId:
          initialData.branchId?._id ||
          initialData.branchId ||
          (isBranchAdmin && user?.branchId ? String(user.branchId) : null) ||
          (activeBranchId && activeBranchId !== 'all' ? activeBranchId : null) ||
          (branches[0]?._id ? String(branches[0]._id) : ''),
        name: initialData.name || '',`
  );
}

// 3. Reset form
content = content.replace(
  /setForm\(\{[\r\n\s]+name: '',[\r\n\s]+barcode: '',[\r\n\s]+categoryId: categories\[0\]\?\._id/,
  `setForm({
        branchId:
          (isBranchAdmin && user?.branchId ? String(user.branchId) : null) ||
          (activeBranchId && activeBranchId !== 'all' ? activeBranchId : null) ||
          (branches[0]?._id ? String(branches[0]._id) : ''),
        name: '',
        barcode: '',
        categoryId: categories[0]?._id`
);

// 4. BaseProduct branchId
content = content.replace(
  /baseProduct: \{[\r\n\s]+name: form\.name\.trim\(\),/,
  `baseProduct: {
          branchId: form.branchId,
          name: form.name.trim(),`
);

// 5. Branch Selector JSX
const branchSelectJsx = `        {/* Multi-Branch Assignment Section */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="font-black text-ink flex items-center gap-1.5 text-xs">
              <Building2 className="w-4 h-4 text-primary" />
              <span>الفرع التابع له هذا المنتج (Branch Assignment) *</span>
            </label>
            {isBranchAdmin ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                مقيد بنطاق فرعك المخصص
              </span>
            ) : (
              <span className="text-[10px] font-bold text-ink-soft">
                يمكن للسوبر آدمن تعيين وتغيير فرع المنتج
              </span>
            )}
          </div>

          {isBranchAdmin ? (
            <div className="p-2.5 rounded-btn bg-surface border border-line text-ink font-bold text-xs flex items-center gap-2">
              <span className="text-base">🏢</span>
              <span>
                {branches.find((b) => String(b._id) === String(form.branchId))?.name || 'الفرع المخصص'}
              </span>
            </div>
          ) : (
            <select
              value={form.branchId || ''}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              className="w-full bg-surface border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink font-bold text-xs"
            >
              <option value="" disabled>-- اختر الفرع التابع له المنتج --</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  🏢 {b.name} ({b.city}) {b.isMain ? '★ [الفرع الرئيسي]' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

`;

if (!content.includes('Multi-Branch Assignment Section')) {
  content = content.replace(
    /(<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">[\r\n\s]+<div className=\{isMultiVariantMode \? 'sm:col-span-3' : 'sm:col-span-2'\}>[\r\n\s]+<label className="block text-ink-soft mb-1">القسم \/ التصنيف \*<\/label>)/,
    `${branchSelectJsx}        $1`
  );
}

fs.writeFileSync(file, content, 'utf8');
console.log('✓ Successfully patched UnifiedProductForm.jsx!');
