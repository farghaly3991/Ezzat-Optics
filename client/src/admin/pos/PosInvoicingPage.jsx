import React, { useState, useEffect, useRef } from 'react';
import {
  ScanBarcode,
  Search,
  Layers,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  ShoppingCart,
  User,
  Phone,
  CreditCard,
  Banknote,
  Wallet,
  Sparkles,
  Package,
  RotateCcw,
  Camera,
  AlertCircle,
  Mic,
  MicOff,
  Copy,
  ExternalLink,
  Maximize2,
  Minimize2,
  History,
  X,
  Check,
  Share2,
  CalendarClock,
  ShieldCheck,
  Eye,
  Wrench,
  Tag,
  DollarSign,
  BellRing,
  UserPlus
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import { useGeminiVoiceInput } from '../../shared/utils/useGeminiVoiceInput';
import InvoiceModal from '../orders/components/InvoiceModal';
import AdminBranchSelector from '../shared/AdminBranchSelector';
import DepositVoucherModal from './components/DepositVoucherModal';
import PosPrescriptionCard from './components/PosPrescriptionCard';
import SupplyRequestModal from './components/SupplyRequestModal';
import OpticsThermalReceiptModal from './components/OpticsThermalReceiptModal';
import OpticsPrescriptionModal from '../customers/components/OpticsPrescriptionModal';
import DynamicClientProfileModal from '../customers/components/DynamicClientProfileModal';
import PosGridPickerModal from './components/PosGridPickerModal';
import AddCustomerModal from '../customers/components/AddCustomerModal';
import WorkOrderModal from '../labs/components/WorkOrderModal';

export default function PosInvoicingPage() {
  const { token, config, showToast, activeBranchId, user } = useStore();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const currency = config?.currency || 'ج.م';
  const profileConfig = config?.clientProfileConfig || {};
  const isProfileEnabled = profileConfig.enabled !== false;
  const isOptics = config?.systemProfile === 'optics' && config?.enableOpticsPrescriptions !== false;

  // Active Acquisition Tab: 'barcode' | 'search' | 'category'
  const [activeTab, setActiveTab] = useState('barcode');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Barcode state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedProductPreview, setScannedProductPreview] = useState(null);
  const [scannedQty, setScannedQty] = useState(1);
  const [autoAddOnScan, setAutoAddOnScan] = useState(true);
  const barcodeInputRef = useRef(null);

  // Quick Add Product Modal (for unregistered scanned barcodes)
  const [quickAddBarcode, setQuickAddBarcode] = useState(null);
  const [quickAddForm, setQuickAddForm] = useState({
    name: '',
    barcode: '',
    categoryId: '',
    price: '',
    costPrice: '',
    stockCount: 10
  });
  const [isSavingQuickProduct, setIsSavingQuickProduct] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Category state
  const [categories, setCategories] = useState([]);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [categoryProducts, setCategoryProducts] = useState([]);
  const [isLoadingCatProds, setIsLoadingCatProds] = useState(false);

  // Voice Assistant
  // Voice Assistant (Gemini Primary -> Official Browser SpeechRecognition Fallback)
  const {
    isListening,
    toggleVoice: toggleVoiceAssistant
  } = useGeminiVoiceInput({
    contextHint: 'pos',
    onTranscript: (transcript, provider) => {
      const sourceLabel = provider === 'gemini' ? 'Gemini Audio' : 'متصفح الويب';
      showToast(`🎙️ تم التقاط (${sourceLabel}): «${transcript}»`);
      setActiveTab('search');
      setSearchQuery(transcript);
    },
    onError: (msg) => {
      showToast(msg, 'error');
    }
  });

  // Live Invoice items: [{ productId, name, price, costPrice, quantity, stockCount, image }]
  const [invoiceItems, setInvoiceItems] = useState([]);

  // Customer & Payment details
  const [customerName, setCustomerName] = useState('عميل المتجر (مباشر)');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'card' | 'wallet' | 'installment'
  const [discountAmount, setDiscountAmount] = useState(0);

  // Installment configuration state
  const [installmentPlan, setInstallmentPlan] = useState({
    months: 6,
    interestRate: 0,
    downPayment: 0,
    guarantorName: '',
    guarantorPhone: '',
    guarantorNationalId: '',
    guarantorRelationship: ''
  });

  // Coupon state in POS
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');

  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) return;
    setValidatingCoupon(true);
    setCouponError('');
    try {
      const res = await axios.post('/api/store-coupons-public/validate', {
        code,
        subtotal
      });
      if (res.data?.valid) {
        setAppliedCoupon(res.data);
        const disc = Number(res.data.discountAmount || 0);
        setDiscountAmount(disc);
        if (showToast) showToast(`تم تطبيق الكوبون «${code}» وخصم ${disc.toLocaleString()} ${currency}!`);
      } else {
        setCouponError(res.data?.error || 'كوبون غير صالح');
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCouponError(err.response?.data?.error || 'فشل التحقق من الكوبون');
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    setDiscountAmount(0);
  };

  // Customer Intelligence state
  const [customerIntelligence, setCustomerIntelligence] = useState(null);
  const [isLookingUpCustomer, setIsLookingUpCustomer] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Optics Specialized State
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isFullPrescriptionOpen, setIsFullPrescriptionOpen] = useState(false);
  const [appliedPrescription, setAppliedPrescription] = useState(null);
  const [isWorkOrderModalOpen, setIsWorkOrderModalOpen] = useState(false);
  const [posWorkOrderConfig, setPosWorkOrderConfig] = useState(null);
  const [labsList, setLabsList] = useState([]);
  const [isLabOrder, setIsLabOrder] = useState(false);
  const [labDeliveryDate, setLabDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // غداً افتراضياً
    return d.toISOString().split('T')[0];
  });
  const [labNotes, setLabNotes] = useState('');
  const [customPaidAmount, setCustomPaidAmount] = useState('');
  const [deductCustomerDeposit, setDeductCustomerDeposit] = useState(true);
  const [supplyModalItem, setSupplyModalItem] = useState(null);
  const [thermalReceiptOrder, setThermalReceiptOrder] = useState(null);

  // Completed sale & new account credentials modal
  const [completedOrder, setCompletedOrder] = useState(null);
  const [newAccountCreated, setNewAccountCreated] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [gridPickerProduct, setGridPickerProduct] = useState(null);

  // Focus barcode input on mount and on tab switch
  useEffect(() => {
    if (activeTab === 'barcode' && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [activeTab]);

  // Load categories on mount
  useEffect(() => {
    if (!token) return;
    axios
      .get('/api/admin/categories', authHeader)
      .then((res) => {
        const list = res.data?.categories || res.data || [];
        setCategories(Array.isArray(list) ? list : []);
        if (list.length > 0) {
          setSelectedCatId(list[0]._id);
          setQuickAddForm((prev) => ({ ...prev, categoryId: list[0]._id }));
        }
      })
      .catch((err) => console.error('Failed to load categories:', err));

    axios
      .get('/api/admin/labs', authHeader)
      .then((res) => setLabsList(res.data?.labs || []))
      .catch(() => {});
  }, [token]);

  // Load products when category changes
  useEffect(() => {
    if (!token || !selectedCatId) return;
    setIsLoadingCatProds(true);
    axios
      .get(`/api/admin/products?categoryId=${selectedCatId}&limit=50`, authHeader)
      .then((res) => setCategoryProducts(res.data?.products || []))
      .catch((err) => console.error('Failed to load category products:', err))
      .finally(() => setIsLoadingCatProds(false));
  }, [token, selectedCatId]);

  // Search products when query changes
  useEffect(() => {
    if (!token || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearching(true);
      axios
        .get(`/api/admin/products?search=${encodeURIComponent(searchQuery.trim())}&limit=20`, authHeader)
        .then((res) => setSearchResults(res.data?.products || []))
        .catch((err) => console.error('Search failed:', err))
        .finally(() => setIsSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [token, searchQuery]);

  // Customer Intelligence Real-time Lookup (Debounced)
  useEffect(() => {
    const raw = customerPhone.trim();
    const cleanPhone = raw.replace(/[\s-]/g, '');

    if (!token || (!raw && (!customerName || customerName === 'عميل المتجر (مباشر)'))) {
      setCustomerIntelligence(null);
      return;
    }

    if (cleanPhone.length < 5 && (!customerName || customerName.length < 3)) {
      setCustomerIntelligence(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLookingUpCustomer(true);
      try {
        const queryTerm = cleanPhone.length >= 5 ? cleanPhone : customerName;
        const res = await axios.get(
          `/api/admin/orders/pos/customer-lookup?q=${encodeURIComponent(queryTerm)}`,
          authHeader
        );
        if (res.data?.done) {
          setCustomerIntelligence(res.data);
          // If customer has a recorded name and current input is default, autofill it
          if (
            res.data.customer?.name &&
            (!customerName || customerName === 'عميل المتجر (مباشر)')
          ) {
            setCustomerName(res.data.customer.name);
          }
          if (res.data.customer?.latestPrescription && !appliedPrescription) {
            setAppliedPrescription(res.data.customer.latestPrescription);
            setIsLabOrder(true);
          }
        }
      } catch (err) {
        console.warn('Customer lookup error:', err.message);
      } finally {
        setIsLookingUpCustomer(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [customerPhone, customerName, token]);

  // Keyboard Shortcuts (F9: Confirm, F2: Barcode, F3: Search, Esc: Reset)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F9') {
        e.preventDefault();
        handleConfirmSale();
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('barcode');
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('search');
      } else if (e.key === 'Escape') {
        if (quickAddBarcode) {
          setQuickAddBarcode(null);
        } else if (showHistoryModal) {
          setShowHistoryModal(false);
        } else if (newAccountCreated) {
          setNewAccountCreated(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Add a product to the ongoing invoice
  const addItemToInvoice = (product, quantity = 1, explicitGridCoords = null) => {
    if (!product || !product._id) return;

    // Check if product belongs to a Category with hasGridSpecs
    const catObj = typeof product.categoryId === 'object' ? product.categoryId : categories.find((c) => c._id === product.categoryId);
    const isGridCategory = Boolean(catObj?.hasGridSpecs || product.opticsSpecs?.isMatrixManaged);

    if (isGridCategory && !explicitGridCoords) {
      setGridPickerProduct(product);
      return;
    }

    const qty = Math.max(1, Number(quantity || 1));
    const slotKey = explicitGridCoords?.unitSlotKey ? `_${explicitGridCoords.unitSlotKey}` : (explicitGridCoords?.eye ? `_${explicitGridCoords.eye}` : '');
    const itemKey = explicitGridCoords
      ? `${product._id}_${explicitGridCoords.sph}_${explicitGridCoords.cyl}${slotKey}`
      : product._id;

    const unitSlotLabel = explicitGridCoords?.unitSlotLabel || (explicitGridCoords?.eye === 'OD' ? 'العين اليمنى' : explicitGridCoords?.eye === 'OS' ? 'العين اليسرى' : '');

    // Check availability (grid cell stock or product stockCount/storeStock)
    const availableStock = explicitGridCoords?.availableQty !== undefined
      ? Number(explicitGridCoords.availableQty)
      : Number(product.stockCount ?? product.storeStock ?? 0);

    const isOutOfStock = availableStock <= 0;

    const newItem = {
      itemKey,
      productId: product._id,
      name: product.name,
      unitSlotKey: explicitGridCoords?.unitSlotKey || explicitGridCoords?.eye || '',
      unitSlotLabel,
      price: Number(product.price || 0),
      costPrice: Number(product.costPrice || 0),
      quantity: qty,
      stockCount: availableStock,
      barcode: product.barcode || '',
      image: (product.images && product.images[0]) || product.image || '',
      gridCoords: explicitGridCoords || null,
      lensSpecs: explicitGridCoords ? {
        sph: explicitGridCoords.sph,
        cyl: explicitGridCoords.cyl,
        eye: explicitGridCoords.unitSlotKey || explicitGridCoords.eye
      } : {},
      isRequestedSupply: isOutOfStock,
      supplierName: isOutOfStock ? 'مورد البصريات المعتمد' : '',
      supplierPhone: isOutOfStock ? '01011180841' : ''
    };

    setInvoiceItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.itemKey === itemKey || (!it.itemKey && !explicitGridCoords && it.productId === product._id));
      if (existingIdx > -1) {
        const copy = [...prev];
        copy[existingIdx].quantity += qty;
        if (isOutOfStock) {
          copy[existingIdx].isRequestedSupply = true;
        }
        return copy;
      }
      return [...prev, newItem];
    });

    const specsInfo = explicitGridCoords
      ? ` (SPH: ${explicitGridCoords.sph} | CYL: ${explicitGridCoords.cyl})`
      : '';

    if (isOutOfStock) {
      showToast(`⚠️ هذا الصنف رصيده صفر بالمخزون، تم تحويله كطلب توريد معلق`, 'warning');
      setSupplyModalItem(newItem);
    } else {
      showToast(`تمت إضافة «${product.name}»${specsInfo} للفاتورة`);
    }
  };

  // Barcode Lookup handler
  const handleBarcodeLookup = async (codeOverride) => {
    const code = (codeOverride || barcodeInput).trim();
    if (!code) return;

    setIsScanning(true);
    try {
      const res = await axios.get(`/api/admin/products/lookup/${encodeURIComponent(code)}`, authHeader);
      const prod = res.data?.product;
      if (prod) {
        if (autoAddOnScan) {
          addItemToInvoice(prod, 1);
          setBarcodeInput('');
          setScannedProductPreview(null);
        } else {
          setScannedProductPreview(prod);
          setScannedQty(1);
        }
      } else {
        promptQuickAdd(code);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        promptQuickAdd(code);
      } else {
        showToast(err.response?.data?.error || 'تعذر مطابقة الباركود', 'error');
      }
    } finally {
      setIsScanning(false);
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }
  };

  // Prompt Quick Add when scanned barcode does not exist
  const promptQuickAdd = (unregisteredCode) => {
    setQuickAddBarcode(unregisteredCode);
    setQuickAddForm({
      name: '',
      barcode: unregisteredCode,
      categoryId: selectedCatId || (categories[0]?._id || ''),
      price: '',
      costPrice: '',
      stockCount: 10
    });
  };

  // Save unregistered product quickly and add directly to bill
  const handleSaveQuickProduct = async (e) => {
    e.preventDefault();
    if (!quickAddForm.name.trim() || !quickAddForm.price) {
      showToast('يرجى إدخال اسم المنتج وسعر البيع', 'error');
      return;
    }

    setIsSavingQuickProduct(true);
    try {
      const payload = {
        name: quickAddForm.name.trim(),
        barcode: quickAddForm.barcode.trim(),
        categoryId: quickAddForm.categoryId,
        price: Number(quickAddForm.price),
        costPrice: Number(quickAddForm.costPrice || 0),
        stockCount: Number(quickAddForm.stockCount || 10),
        active: true
      };

      const res = await axios.post('/api/admin/products', payload, authHeader);
      const newProd = res.data?.product || res.data;
      if (newProd && newProd._id) {
        showToast('تم تسجيل المنتج الجديد بنجاح وإضافته للفاتورة');
        addItemToInvoice(newProd, 1);
        setQuickAddBarcode(null);
        setBarcodeInput('');
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
      }
    } catch (err) {
      console.error('Quick product create failed:', err);
      showToast(err.response?.data?.error || 'فشل حفظ المنتج الجديد', 'error');
    } finally {
      setIsSavingQuickProduct(false);
    }
  };

  const handleBarcodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeLookup();
    }
  };

  // Modify line item quantity
  const updateItemQty = (targetKey, newQty) => {
    const qty = Math.max(1, Number(newQty || 1));
    setInvoiceItems((prev) =>
      prev.map((it) => ((it.itemKey || it.productId) === targetKey ? { ...it, quantity: qty } : it))
    );
  };

  // Remove line item
  const removeItem = (targetKey) => {
    setInvoiceItems((prev) => prev.filter((it) => (it.itemKey || it.productId) !== targetKey));
  };

  // Clear all invoice
  const resetInvoice = () => {
    if (invoiceItems.length > 0 && !window.confirm('هل أنت متأكد من تفريغ الفاتورة الحالية؟')) {
      return;
    }
    setInvoiceItems([]);
    setCustomerName('عميل المتجر (مباشر)');
    setCustomerPhone('');
    setCustomerNotes('');
    setDiscountAmount(0);
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    setScannedProductPreview(null);
    setBarcodeInput('');
    setCustomerIntelligence(null);
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  };

  // Calculate invoice financial totals
  const subtotal = invoiceItems.reduce(
    (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 1),
    0
  );
  const netBeforeDeposit = Math.max(0, subtotal - Number(discountAmount || 0));

  const customerDepositBalance = customerIntelligence?.customer?.depositBalance || 0;
  const depositDeduction = (deductCustomerDeposit && customerDepositBalance > 0)
    ? Math.min(customerDepositBalance, netBeforeDeposit)
    : 0;

  const total = Math.max(0, netBeforeDeposit - depositDeduction);

  const effectivePaidNow = customPaidAmount !== ''
    ? Math.min(total, Number(customPaidAmount))
    : total;
  const remainingAtDelivery = Math.max(0, total - effectivePaidNow);

  // Submit & Record POS Order
  const handleConfirmSale = async () => {
    if (invoiceItems.length === 0) {
      showToast('الفاتورة فارغة، يرجى إضافة منتج واحد على الأقل', 'error');
      return;
    }

    if (paymentMethod === 'installment') {
      const cleanP = customerPhone.trim().replace(/[\s-]/g, '');
      if (!cleanP || cleanP.length < 8) {
        showToast('يرجى إدخال رقم هاتف صحيح للعميل لربط ومتابعة أقساطه الشهرية', 'error');
        return;
      }
      if (!customerName.trim() || customerName.trim() === 'عميل المتجر (مباشر)') {
        showToast('يرجى إدخال اسم العميل لتسجيل عقد التقسيط باسمه', 'error');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        items: invoiceItems.map((it) => ({
          productId: it.productId,
          name: it.unitSlotLabel ? `${it.name} - ${it.unitSlotLabel}` : it.name,
          unitSlotKey: it.unitSlotKey || '',
          unitSlotLabel: it.unitSlotLabel || '',
          price: it.price,
          quantity: it.quantity,
          image: it.image,
          productType: it.productType || 'frame',
          lensSpecs: it.lensSpecs || {},
          frameSpecs: it.frameSpecs || {},
          gridCoords: it.gridCoords || null,
          isRequestedSupply: Boolean(it.isRequestedSupply),
          supplierName: it.supplierName || '',
          supplierPhone: it.supplierPhone || ''
        })),
        customer: {
          name: customerName.trim() || 'عميل المتجر (مباشر)',
          phone: customerPhone.trim() || '00000000000',
          address: 'استلام مباشر من الفرع',
          city: 'الفرع الرئيسي',
          notes: customerNotes.trim()
        },
        paymentMethod,
        isLabOrder,
        labDeliveryDate: isLabOrder ? labDeliveryDate : null,
        labNotes: isLabOrder ? labNotes : '',
        prescriptionSnapshot: appliedPrescription ? {
          sphR: appliedPrescription.rightEye?.sph,
          cylR: appliedPrescription.rightEye?.cyl,
          axisR: appliedPrescription.rightEye?.axis,
          addR: appliedPrescription.rightEye?.add,
          pdR: appliedPrescription.rightEye?.pd,
          sphL: appliedPrescription.leftEye?.sph,
          cylL: appliedPrescription.leftEye?.cyl,
          axisL: appliedPrescription.leftEye?.axis,
          addL: appliedPrescription.leftEye?.add,
          pdL: appliedPrescription.leftEye?.pd,
          ipd: appliedPrescription.ipd,
          doctorName: appliedPrescription.doctorName,
          usageType: appliedPrescription.usageType
        } : null,
        paidAmount: effectivePaidNow,
        previousDepositDeducted: depositDeduction,
        installmentPlan: paymentMethod === 'installment' ? {
          months: Number(installmentPlan.months) || 6,
          interestRate: Number(installmentPlan.interestRate) || 0,
          downPayment: Number(installmentPlan.downPayment) || 0,
          guarantor: {
            name: installmentPlan.guarantorName.trim(),
            phone: installmentPlan.guarantorPhone.trim(),
            nationalId: installmentPlan.guarantorNationalId.trim(),
            relationship: installmentPlan.guarantorRelationship.trim()
          }
        } : undefined,
        discount: Number(discountAmount || 0),
        coupon: appliedCoupon?.coupon?.code || undefined,
        couponCode: appliedCoupon?.coupon?.code || undefined,
        notes: customerNotes.trim(),
        branchId: activeBranchId || user?.branchId || undefined
      };

      const res = await axios.post('/api/admin/orders/pos-sale', payload, authHeader);
      if (res.data?.order) {
        showToast(
          isLabOrder
            ? 'تم تسجيل أمر شغل المعمل بنجاح!'
            : res.data.message || 'تم تسجيل عملية البيع بنجاح وتحديث المخزون!'
        );
        setCompletedOrder(res.data.order);
        setThermalReceiptOrder(res.data.order); // Open 80mm thermal receipt

        // Check if a new customer account was automatically created
        if (res.data?.customerAccount?.isNew) {
          setNewAccountCreated(res.data.customerAccount);
        }

        // Auto-create Work Order if configured
        if (posWorkOrderConfig && res.data.order?.orderId) {
          axios.post('/api/admin/work-orders', {
            orderId: res.data.order.orderId,
            labId: posWorkOrderConfig.labId,
            expectedDeliveryDate: posWorkOrderConfig.expectedDeliveryDate,
            financials: posWorkOrderConfig.financials,
            notes: posWorkOrderConfig.notes
          }, authHeader).catch((e) => console.warn('Could not auto-create work order:', e));
          setPosWorkOrderConfig(null);
        }

        setInvoiceItems([]);
        setDiscountAmount(0);
        setAppliedCoupon(null);
        setCouponCode('');
        setCouponError('');
        setCustomPaidAmount('');
        setCustomerNotes('');
        setCustomerPhone('');
        setCustomerIntelligence(null);
        setAppliedPrescription(null);
        setIsLabOrder(false);
        setInstallmentPlan({
          months: 6,
          interestRate: 0,
          downPayment: 0,
          guarantorName: '',
          guarantorPhone: '',
          guarantorNationalId: '',
          guarantorRelationship: ''
        });
      }
    } catch (err) {
      console.error('POS sale failed:', err);
      showToast(err.response?.data?.error || 'فشل تسجيل عملية البيع', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cleanCustomerPhone = customerPhone.replace(/[\s-]/g, '');
  const hasTypedCustomerPhone = cleanCustomerPhone.length >= 6;

  return (
    <div
      className={`space-y-6 animate-in fade-in duration-200 ${
        isFullscreen ? 'fixed inset-0 z-50 bg-paper p-6 overflow-y-auto' : ''
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-surface border border-line shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black shadow-lg shadow-emerald-500/25">
            <ScanBarcode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-ink">
                نظام الكاشير ونقطة البيع (POS)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[11px] font-black">
                إصدار متقدم
              </span>
            </div>
            <p className="text-xs text-ink-soft mt-0.5 font-medium">
              مسح باركود المصنع أو النظام، بحث فوري، مساعد صوتي، وذكاء العملاء مع إنشاء حسابات فورية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2.5 rounded-xl bg-paper border border-line text-ink hover:text-primary transition-colors"
            title={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة للكاشير'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Reset button */}
          <button
            onClick={resetInvoice}
            disabled={invoiceItems.length === 0}
            className="px-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink hover:text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-1.5 disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إفراغ الفاتورة</span>
          </button>
        </div>
      </div>

      {/* Branch Scope Selector */}
      <AdminBranchSelector
        label="فرع نقطة البيع ومخزون الفاتورة:"
      />

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* LEFT / MAIN COLUMN: PRODUCT SELECTION (7 COLS) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 space-y-4">
          {/* Method Selection Tabs */}
          <div className="flex items-center justify-between border-b border-line pb-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('barcode')}
                className={`px-4 py-2.5 rounded-btn text-xs font-black transition-all flex items-center gap-2 ${
                  activeTab === 'barcode'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-ink-soft hover:text-ink hover:bg-paper'
                }`}
              >
                <ScanBarcode className="w-4 h-4" />
                <span>1. مسح الباركود [F2]</span>
              </button>

              <button
                onClick={() => setActiveTab('search')}
                className={`px-4 py-2.5 rounded-btn text-xs font-black transition-all flex items-center gap-2 ${
                  activeTab === 'search'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-ink-soft hover:text-ink hover:bg-paper'
                }`}
              >
                <Search className="w-4 h-4" />
                <span>2. البحث المباشر [F3]</span>
              </button>

              <button
                onClick={() => setActiveTab('category')}
                className={`px-4 py-2.5 rounded-btn text-xs font-black transition-all flex items-center gap-2 ${
                  activeTab === 'category'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-ink-soft hover:text-ink hover:bg-paper'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>3. فلترة الأقسام ({categories.length})</span>
              </button>
            </div>

            {/* Voice Assistant Launcher */}
            <button
              type="button"
              onClick={toggleVoiceAssistant}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                isListening
                  ? 'bg-red-500 text-white border-red-600 animate-pulse'
                  : 'bg-paper text-ink border-line hover:border-emerald-500'
              }`}
              title="مساعد البحث الصوتي للكاشير"
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-primary" />}
              <span>{isListening ? 'جاري الاستماع...' : 'مساعد صوتي'}</span>
            </button>
          </div>

          {/* TAB 1: BARCODE SCANNER */}
          {activeTab === 'barcode' && (
            <div className="space-y-4 p-5 rounded-3xl bg-surface border border-line shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink flex items-center gap-2">
                  <ScanBarcode className="w-4 h-4 text-emerald-600" />
                  <span>قارئ الباركود (ماسح الليزر / باركود المصنع / معرّف ID)</span>
                </span>

                <label className="flex items-center gap-2 text-xs font-bold text-ink-soft cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAddOnScan}
                    onChange={(e) => setAutoAddOnScan(e.target.checked)}
                    className="accent-emerald-600"
                  />
                  <span>إضافة تلقائية فور المسح</span>
                </label>
              </div>

              {/* Barcode input box */}
              <div className="relative">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  placeholder="مرر قارئ الباركود، أو اكتب باركود المصنع واضغط Enter..."
                  className="w-full pl-28 pr-11 py-3.5 rounded-2xl bg-paper border-2 border-line text-sm font-mono font-bold text-ink outline-none focus:border-emerald-500 transition-all shadow-inner"
                  autoFocus
                />
                <ScanBarcode className="w-5 h-5 text-ink-soft absolute right-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => handleBarcodeLookup()}
                  disabled={isScanning || !barcodeInput.trim()}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-colors disabled:opacity-40"
                >
                  {isScanning ? 'جاري الفحص...' : 'فحص ومطابقة'}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-ink-soft">
                <span>💡 يدعم باركود العلبة (EAN-13, UPC) وكود النظام التلقائي.</span>
                <span className="font-bold text-emerald-600">اختصار التأكيد: F9</span>
              </div>

              {/* Preview of scanned product if autoAddOnScan is false */}
              {scannedProductPreview && (
                <div className="p-4 rounded-2xl bg-paper border border-emerald-500/30 flex items-center justify-between gap-4 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        (scannedProductPreview.images && scannedProductPreview.images[0]) ||
                        scannedProductPreview.image ||
                        'https://via.placeholder.com/60'
                      }
                      alt={scannedProductPreview.name}
                      className="w-14 h-14 object-cover rounded-xl border border-line"
                    />
                    <div>
                      <h4 className="font-black text-sm text-ink">{scannedProductPreview.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-xs">
                        <span className="font-mono font-bold text-emerald-600">
                          {scannedProductPreview.price} {currency}
                        </span>
                        <span className="text-ink-soft">•</span>
                        <span className="text-ink-soft">
                          المتوفر: {scannedProductPreview.stockCount} قطعة
                        </span>
                        {scannedProductPreview.barcode && (
                          <span className="text-[10px] font-mono bg-paper px-1.5 py-0.5 rounded border border-line">
                            {scannedProductPreview.barcode}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-line rounded-xl bg-surface p-1">
                      <button
                        type="button"
                        onClick={() => setScannedQty((q) => Math.max(1, q - 1))}
                        className="p-1 hover:bg-paper rounded-lg text-ink"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center font-mono font-bold text-xs">{scannedQty}</span>
                      <button
                        type="button"
                        onClick={() => setScannedQty((q) => q + 1)}
                        className="p-1 hover:bg-paper rounded-lg text-ink"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        addItemToInvoice(scannedProductPreview, scannedQty);
                        setScannedProductPreview(null);
                        setBarcodeInput('');
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black shadow-md hover:bg-emerald-700"
                    >
                      إضافة للفاتورة
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SMART SEARCH */}
          {activeTab === 'search' && (
            <div className="space-y-4 p-5 rounded-3xl bg-surface border border-line shadow-sm">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم المنتج، المواصفات، أو الباركود..."
                  className="w-full pl-4 pr-11 py-3 rounded-2xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-emerald-600 shadow-sm"
                  autoFocus
                />
                <Search className="w-4 h-4 text-ink-soft absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>

              {isSearching ? (
                <div className="py-12 text-center text-xs text-ink-soft font-bold">
                  جاري البحث في الكتالوج...
                </div>
              ) : searchResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                  {searchResults.map((prod) => (
                    <div
                      key={prod._id}
                      className="p-3 rounded-2xl bg-paper border border-line flex items-center justify-between gap-3 hover:border-emerald-500/50 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={
                            (prod.images && prod.images[0]) ||
                            prod.image ||
                            'https://via.placeholder.com/50'
                          }
                          alt={prod.name}
                          className="w-12 h-12 object-cover rounded-xl border border-line shrink-0"
                        />
                        <div className="min-w-0">
                          <h5 className="font-bold text-xs text-ink truncate">{prod.name}</h5>
                          <div className="text-[11px] font-mono text-emerald-600 font-black">
                            {prod.price} {currency}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-ink-soft">
                            <span>المخزون: {prod.stockCount}</span>
                            {prod.barcode && <span>• باركود: {prod.barcode}</span>}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => addItemToInvoice(prod, 1)}
                        className="p-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shrink-0"
                        title="إضافة للفاتورة"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : searchQuery.trim() ? (
                <div className="py-12 text-center text-xs text-ink-soft">
                  لم يتم العثور على أي منتج يطابق «{searchQuery}»
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-ink-soft">
                  ابدأ بكتابة اسم المنتج أو كوده للبحث المباشر، أو استخدم المساعد الصوتي
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CATEGORY FILTER */}
          {activeTab === 'category' && (
            <div className="space-y-4 p-5 rounded-3xl bg-surface border border-line shadow-sm">
              {/* Category pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat._id}
                    type="button"
                    onClick={() => setSelectedCatId(cat._id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all border ${
                      selectedCatId === cat._id
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-paper text-ink border-line hover:border-emerald-500/50'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Products list under selected category */}
              {isLoadingCatProds ? (
                <div className="py-12 text-center text-xs text-ink-soft font-bold">
                  جاري تحميل منتجات القسم...
                </div>
              ) : categoryProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                  {categoryProducts.map((prod) => (
                    <div
                      key={prod._id}
                      className="p-3 rounded-2xl bg-paper border border-line flex items-center justify-between gap-3 hover:border-emerald-500/50 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={
                            (prod.images && prod.images[0]) ||
                            prod.image ||
                            'https://via.placeholder.com/50'
                          }
                          alt={prod.name}
                          className="w-12 h-12 object-cover rounded-xl border border-line shrink-0"
                        />
                        <div className="min-w-0">
                          <h5 className="font-bold text-xs text-ink truncate">{prod.name}</h5>
                          <div className="text-[11px] font-mono text-emerald-600 font-black">
                            {prod.price} {currency}
                          </div>
                          <span className="text-[10px] text-ink-soft block">
                            المخزون: {prod.stockCount}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => addItemToInvoice(prod, 1)}
                        className="p-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shrink-0"
                        title="إضافة للفاتورة"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-ink-soft">
                  لا توجد منتجات مسجلة في هذا القسم حالياً
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: LIVE ONGOING INVOICE BILL (5 COLS) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-3xl bg-surface border-2 border-line shadow-lg space-y-4 sticky top-6">
            {/* Invoice Top Header */}
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-sm text-ink">بنود الفاتورة الحالية</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-black">
                {invoiceItems.length} منتجات
              </span>
            </div>

            {/* Items list */}
            {invoiceItems.length === 0 ? (
              <div className="py-10 text-center space-y-2 rounded-2xl bg-paper border border-dashed border-line">
                <ScanBarcode className="w-8 h-8 text-ink-soft mx-auto opacity-50" />
                <p className="text-xs font-bold text-ink">الفاتورة فارغة حتى الآن</p>
                <p className="text-[11px] text-ink-soft max-w-xs mx-auto">
                  امسح الباركود، أو ابحث عن المنتجات لإضافتها فوراً إلى هذه الفاتورة.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 divide-y divide-line/60">
                {invoiceItems.map((it) => (
                  <div key={it.itemKey || it.productId} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={it.image || 'https://via.placeholder.com/40'}
                        alt={it.name}
                        className="w-10 h-10 object-cover rounded-lg border border-line shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h5 className="font-bold text-xs text-ink truncate">{it.name}</h5>
                          {it.unitSlotLabel && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-black text-[9px] border border-indigo-200">
                              {it.unitSlotLabel}
                            </span>
                          )}
                        </div>
                        {it.gridCoords && (
                          <div className="flex flex-wrap items-center gap-1.5 my-0.5">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-black font-mono">
                              SPH: {it.gridCoords.sph} | CYL: {it.gridCoords.cyl}
                            </span>
                            {it.gridCoords.availableQty !== undefined && (
                              <span className={`text-[10px] font-bold ${it.gridCoords.availableQty >= it.quantity ? 'text-emerald-600' : 'text-amber-600'}`}>
                                (متاح: {it.gridCoords.availableQty})
                              </span>
                            )}
                          </div>
                        )}
                        <div className="text-[11px] font-mono text-ink-soft flex items-center gap-2">
                          <span>
                            {it.price} {currency} × {it.quantity} ={' '}
                            <b className="text-emerald-600 font-bold">
                              {(it.price * it.quantity).toLocaleString()} {currency}
                            </b>
                          </span>
                          {it.isRequestedSupply ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold border border-amber-300">
                              📦 طلب توريد: {it.supplierName || 'مورد'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSupplyModalItem(it)}
                              className="text-[9px] text-amber-600 hover:text-amber-700 underline font-bold"
                              title="تعليم الصنف غير المتوفر كطلب توريد"
                            >
                              + طلب توريد
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Qty controls */}
                      <div className="flex items-center border border-line rounded-lg bg-paper">
                        <button
                          type="button"
                          onClick={() => updateItemQty(it.itemKey || it.productId, it.quantity - 1)}
                          className="p-1 hover:text-red-500 text-ink-soft"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold font-mono">
                          {it.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateItemQty(it.itemKey || it.productId, it.quantity + 1)}
                          className="p-1 hover:text-emerald-500 text-ink-soft"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(it.itemKey || it.productId)}
                        className="p-1.5 text-ink-soft hover:text-red-500 rounded-lg hover:bg-paper transition-colors"
                        title="حذف البند"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Customer Information & Real-time Intelligence */}
            <div className="pt-3 border-t border-line space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-black text-ink block text-[11px]">بيانات العميل:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAddCustomerModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-black transition-colors shadow-2xs"
                    title="تسجيل عميل جديد وحفظ ملفه"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>+ عميل جديد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDepositModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-black transition-colors shadow-2xs"
                    title="استلام دفعة نقدية تحت الحساب بلا فاتورة وبلا حجز بضاعة"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                    <span>💵 دفعة تحت الحساب</span>
                  </button>
                  {isLookingUpCustomer && (
                    <span className="text-[10px] text-ink-soft animate-pulse font-bold">
                      جاري فحص السجل...
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="اسم العميل (اختياري)..."
                    className="w-full p-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="رقم هاتف العميل..."
                    className="w-full p-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none font-mono focus:border-emerald-500"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Customer Prescription / Custom Profile Card in POS */}
              {isProfileEnabled && customerIntelligence?.customer && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-ink-soft">
                      {profileConfig.profileTitle || 'سجل العميل والقياسات'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsFullPrescriptionOpen(true)}
                      className="text-[11px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 transition-all flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>إظهار {profileConfig.actionButtonLabel || 'فحص كشف النظر'}</span>
                    </button>
                  </div>
                  {customerIntelligence.customer.latestPrescription && (
                    <PosPrescriptionCard
                      prescription={customerIntelligence.customer.latestPrescription}
                      customer={customerIntelligence.customer}
                      appliedPrescription={appliedPrescription}
                      onApplyPrescription={(p) => setAppliedPrescription(appliedPrescription ? null : p)}
                      onOpenFullPrescriptionsModal={() => setIsFullPrescriptionOpen(true)}
                    />
                  )}
                </div>
              )}

              {/* Customer Previous Deposit Balance Alert */}
              {customerDepositBalance > 0 && (
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs animate-fadeIn">
                  <div className="flex items-center gap-1.5 text-blue-900 font-bold">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>رصيد سابق تحت الحساب: <b>{customerDepositBalance.toLocaleString()} {currency}</b></span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-black text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-blue-200">
                    <input
                      type="checkbox"
                      checked={deductCustomerDeposit}
                      onChange={(e) => setDeductCustomerDeposit(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 rounded"
                    />
                    <span>خصم من الفاتورة (-{depositDeduction} {currency})</span>
                  </label>
                </div>
              )}

              {/* Work Order Action Button (Optics & Dynamic Grid Mode) */}
              {isOptics && (
                <div className="p-3 rounded-2xl bg-paper border border-line space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-amber-600" />
                      <div>
                        <span className="text-xs font-black text-ink block">أمر تشغيل معمل وتفصيل عدسات</span>
                        <span className="text-[10px] text-ink-soft">
                          {posWorkOrderConfig
                            ? `تم التجهيز: ${posWorkOrderConfig.labName} (تسليم: ${posWorkOrderConfig.expectedDeliveryDate || 'غير محدد'})`
                            : 'تحديد المعمل، مراحل العمل، والتكاليف في نموذج مخصص'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (invoiceItems.length === 0) {
                          showToast('يرجى إضافة منتجات إلى الفاتورة أولاً', 'error');
                          return;
                        }
                        setIsWorkOrderModalOpen(true);
                      }}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all shadow-sm flex items-center gap-1.5 ${
                        posWorkOrderConfig
                          ? 'bg-amber-600 text-white hover:bg-amber-700'
                          : 'bg-primary/10 text-primary hover:bg-primary/20'
                      }`}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>{posWorkOrderConfig ? 'تعديل أمر التشغيل' : 'تجهيز أمر تشغيل معمل'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Customer Intelligence Badge / Card */}
              {customerIntelligence?.found && customerIntelligence?.customer ? (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>عميل مسجل في المتجر</span>
                    </span>
                    {customerIntelligence.recentOrders?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowHistoryModal(true)}
                        className="text-[10px] text-emerald-700 underline font-bold flex items-center gap-0.5"
                      >
                        <History className="w-3 h-3" />
                        <span>سجل المشتريات ({customerIntelligence.stats?.ordersCount || 0})</span>
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-ink flex items-center justify-between font-mono">
                    <span>
                      إجمالي المشتريات: <b>{customerIntelligence.stats?.totalSpent?.toLocaleString()} {currency}</b>
                    </span>
                    <span>
                      عدد الطلبات: <b>{customerIntelligence.stats?.ordersCount}</b>
                    </span>
                  </div>
                </div>
              ) : hasTypedCustomerPhone && !customerIntelligence?.found ? (
                <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-xs space-y-1 animate-in fade-in">
                  <span className="font-black text-blue-700 dark:text-blue-300 block text-[11px]">
                    ✨ عميل جديد (إنشاء حساب تلقائي):
                  </span>
                  <p className="text-[10px] text-ink-soft leading-relaxed">
                    سيتم تفعيل حساب فوري للعميل، واستخدام رقم الهاتف (<b>{cleanCustomerPhone}</b>) كاسم مستخدم وكلمة مرور، ليتمكن من استعراض الفاتورة على المتجر فوراً.
                  </p>
                </div>
              ) : null}

              {/* Payment Method Selector */}
              <div>
                <label className="block text-[11px] font-bold text-ink-soft mb-1">
                  طريقة السداد:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-1.5 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-paper text-ink border-line hover:border-emerald-500/50'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>كاش نقدي</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`py-1.5 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 transition-all ${
                      paymentMethod === 'card'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-paper text-ink border-line hover:border-emerald-500/50'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>بطاقة دفع</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`py-1.5 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 transition-all ${
                      paymentMethod === 'wallet'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-paper text-ink border-line hover:border-emerald-500/50'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>محفظة</span>
                  </button>

                  {config?.enabledModules?.installments !== false && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('installment')}
                      className={`py-1.5 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 transition-all ${
                        paymentMethod === 'installment'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : 'bg-paper text-ink border-line hover:border-amber-500/50'
                      }`}
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>تقسيط متجر</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Installment Plan Configuration Box (Visible only when installment is selected) */}
              {paymentMethod === 'installment' && (
                <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 space-y-3 animate-in fade-in slide-in-from-top-1 text-xs">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                    <span className="font-black text-amber-600 dark:text-amber-400 flex items-center gap-1 text-[11px]">
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>خطة التقسيط المباشر مع المتجر</span>
                    </span>
                    <span className="text-[10px] text-ink-soft font-mono">
                      مباشر بدون بنك / فاليو
                    </span>
                  </div>

                  {/* Months Selector */}
                  <div>
                    <label className="block text-[10px] font-bold text-ink-soft mb-1">
                      مدة التقسيط بالشهور:
                    </label>
                    <div className="grid grid-cols-6 gap-1">
                      {[3, 6, 9, 12, 18, 24].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setInstallmentPlan((p) => ({ ...p, months: m }))}
                          className={`py-1 rounded-lg text-[11px] font-mono font-black border transition-all ${
                            Number(installmentPlan.months) === m
                              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                              : 'bg-paper text-ink border-line hover:border-amber-400'
                          }`}
                        >
                          {m} ش
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Down Payment & Interest Rate */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-ink-soft mb-1">
                        المقدم النقدي المدفوع:
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max={total}
                          value={installmentPlan.downPayment || ''}
                          onChange={(e) =>
                            setInstallmentPlan((p) => ({
                              ...p,
                              downPayment: Math.max(0, Number(e.target.value) || 0)
                            }))
                          }
                          placeholder="0"
                          className="w-full p-1.5 rounded-lg bg-paper border border-line text-xs font-mono font-bold text-ink text-center outline-none focus:border-amber-500"
                        />
                        <span className="text-[9px] text-ink-soft font-bold">{currency}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-ink-soft mb-1">
                        فائدة / هامش إجمالي %:
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={installmentPlan.interestRate || ''}
                          onChange={(e) =>
                            setInstallmentPlan((p) => ({
                              ...p,
                              interestRate: Math.max(0, Number(e.target.value) || 0)
                            }))
                          }
                          placeholder="0"
                          className="w-full p-1.5 rounded-lg bg-paper border border-line text-xs font-mono font-bold text-ink text-center outline-none focus:border-amber-500"
                        />
                        <span className="text-[10px] text-ink-soft font-bold">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Live Calculated Stats */}
                  {(() => {
                    const m = Math.max(1, Number(installmentPlan.months) || 6);
                    const dp = Math.min(total, Math.max(0, Number(installmentPlan.downPayment) || 0));
                    const principal = Math.max(0, total - dp);
                    const rate = Math.max(0, Number(installmentPlan.interestRate) || 0);
                    const interest = Math.round((principal * (rate / 100)) * 100) / 100;
                    const totalFinanced = principal + interest;
                    const totalContract = dp + totalFinanced;
                    const monthly = Math.round((totalFinanced / m) * 100) / 100;

                    return (
                      <div className="p-2.5 rounded-xl bg-paper/80 border border-amber-500/20 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between text-ink-soft">
                          <span>المبلغ المقسط بعد المقدم:</span>
                          <span className="font-mono font-bold text-ink">{principal.toLocaleString()} {currency}</span>
                        </div>
                        {interest > 0 && (
                          <div className="flex items-center justify-between text-amber-600 font-bold">
                            <span>الفائدة المضافة ({rate}%):</span>
                            <span className="font-mono">+{interest.toLocaleString()} {currency}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-ink font-bold pt-1 border-t border-line">
                          <span>إجمالي العقد النهائي:</span>
                          <span className="font-mono text-amber-600 font-black">{totalContract.toLocaleString()} {currency}</span>
                        </div>
                        <div className="flex items-center justify-between bg-amber-500/10 p-1.5 rounded-lg text-amber-700 dark:text-amber-300 font-black">
                          <span>القسط الشهري المستحق:</span>
                          <span className="font-mono text-xs">{monthly.toLocaleString()} {currency} / شهر ({m} أقساط)</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Guarantor Info (Optional / Collapsible inputs) */}
                  <div className="pt-1 border-t border-amber-500/20 space-y-2">
                    <span className="font-black text-[10px] text-ink-soft flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-amber-600" />
                      <span>بيانات الضامن (اختياري لضمان المعاملة):</span>
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        placeholder="اسم الضامن"
                        value={installmentPlan.guarantorName}
                        onChange={(e) =>
                          setInstallmentPlan((p) => ({ ...p, guarantorName: e.target.value }))
                        }
                        className="p-1.5 rounded-lg bg-paper border border-line text-[11px] text-ink outline-none"
                      />
                      <input
                        type="tel"
                        placeholder="هاتف الضامن"
                        value={installmentPlan.guarantorPhone}
                        onChange={(e) =>
                          setInstallmentPlan((p) => ({ ...p, guarantorPhone: e.target.value }))
                        }
                        className="p-1.5 rounded-lg bg-paper border border-line text-[11px] font-mono text-ink outline-none"
                      />
                      <input
                        type="text"
                        placeholder="الرقم القومي للضامن"
                        value={installmentPlan.guarantorNationalId}
                        onChange={(e) =>
                          setInstallmentPlan((p) => ({ ...p, guarantorNationalId: e.target.value }))
                        }
                        className="p-1.5 rounded-lg bg-paper border border-line text-[11px] font-mono text-ink outline-none"
                      />
                      <input
                        type="text"
                        placeholder="صلة القرابة (أب / أخ ...)"
                        value={installmentPlan.guarantorRelationship}
                        onChange={(e) =>
                          setInstallmentPlan((p) => ({ ...p, guarantorRelationship: e.target.value }))
                        }
                        className="p-1.5 rounded-lg bg-paper border border-line text-[11px] text-ink outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Coupon Code Input */}
              {config?.enabledModules?.coupons !== false && (
                <div className="space-y-1 bg-paper/60 p-2.5 rounded-xl border border-line">
                  <div className="flex items-center justify-between text-[11px] font-bold text-ink-soft">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-primary" />
                      <span>كوبون الخصم (Promo / Voucher):</span>
                    </span>
                    {appliedCoupon && (
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-[10px] text-red-500 hover:underline font-bold"
                      >
                        إلغاء الكوبون
                      </button>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      disabled={Boolean(appliedCoupon)}
                      placeholder="أدخل كود الكوبون المطبوع..."
                      className="flex-1 p-1.5 rounded-lg bg-surface border border-line text-xs font-mono font-bold uppercase text-ink outline-none focus:border-primary placeholder:text-ink-soft/40"
                    />
                    {!appliedCoupon ? (
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={validatingCoupon || !couponCode.trim()}
                        className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-all disabled:opacity-50"
                      >
                        {validatingCoupon ? '...' : 'تطبيق'}
                      </button>
                    ) : (
                      <span className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 font-bold text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>مطبق</span>
                      </span>
                    )}
                  </div>

                  {couponError && (
                    <div className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{couponError}</span>
                    </div>
                  )}

                  {appliedCoupon && (
                    <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                      ✓ خصم الكوبون «{appliedCoupon.coupon?.code}»: وفر {discountAmount.toLocaleString()} {currency}
                    </div>
                  )}
                </div>
              )}

              {/* Discount Input */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-ink-soft">خصم إضافي على الفاتورة:</span>
                <div className="flex items-center gap-1 w-28">
                  <input
                    type="number"
                    min="0"
                    value={discountAmount || ''}
                    onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full p-1.5 rounded-lg bg-paper border border-line text-xs font-mono font-bold text-ink outline-none text-center"
                  />
                  <span className="text-[10px] text-ink-soft font-bold">{currency}</span>
                </div>
              </div>
            </div>

            {/* Financial Totals */}
            <div className="pt-3 border-t-2 border-line space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-ink-soft">
                <span>المجموع الفرعي:</span>
                <span className="font-mono font-bold">{subtotal.toLocaleString()} {currency}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-600 font-bold">
                  <span>الخصم المطبق:</span>
                  <span className="font-mono">-{discountAmount.toLocaleString()} {currency}</span>
                </div>
              )}

              {depositDeduction > 0 && (
                <div className="flex items-center justify-between text-blue-600 font-bold">
                  <span>دفعة سابقة مخصومة (عربون):</span>
                  <span className="font-mono">-{depositDeduction.toLocaleString()} {currency}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-base font-black text-ink pt-1 border-t border-line">
                <span>{paymentMethod === 'installment' ? 'المستحق نقداً الآن (المقدم):' : 'المطلوب سداده:'}</span>
                <span className="font-mono text-blue-700 text-lg">
                  {paymentMethod === 'installment'
                    ? `${Number(installmentPlan.downPayment || 0).toLocaleString()} ${currency}`
                    : `${total.toLocaleString()} ${currency}`}
                </span>
              </div>

              {/* Lab Order / Deposit & Remaining Breakdown */}
              {isLabOrder && paymentMethod !== 'installment' && (
                <div className="pt-2 border-t border-dashed border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-700">المدفوع نقداً الآن (عربون):</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max={total}
                        placeholder={String(total)}
                        value={customPaidAmount}
                        onChange={(e) => setCustomPaidAmount(e.target.value)}
                        className="w-24 p-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-mono font-black text-emerald-700 text-center outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setCustomPaidAmount(String(total))}
                        className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-[10px] font-bold text-slate-700"
                      >
                        دفع كامل
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-black p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                    <span>المتبقي عند الاستلام:</span>
                    <span className="font-mono text-sm">{remainingAtDelivery.toLocaleString()} {currency}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmSale}
                disabled={isSubmitting || invoiceItems.length === 0}
                className={`w-full py-3.5 rounded-2xl font-black text-sm shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 text-white ${
                  isLabOrder
                    ? 'bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 shadow-blue-500/25'
                    : paymentMethod === 'installment'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-amber-500/25'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/25'
                }`}
              >
                {isLabOrder ? (
                  <Wrench className="w-5 h-5" />
                ) : paymentMethod === 'installment' ? (
                  <CalendarClock className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                <span>
                  {isSubmitting
                    ? 'جاري الحفظ وإصدار الإيصال...'
                    : isLabOrder
                    ? 'تأكيد أمر الشغل وطباعة الإيصال الحراري [F9]'
                    : paymentMethod === 'installment'
                    ? 'تأكيد عقد التقسيط وإصدار الفاتورة [F9]'
                    : 'تأكيد عملية البيع وإصدار الفاتورة [F9]'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Quick Product Add Modal (When Barcode is Not Registered) */}
      {quickAddBarcode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-surface border border-line shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 text-emerald-600">
                <Plus className="w-5 h-5" />
                <h3 className="font-black text-sm text-ink">تسجيل منتج سريع في النظام</h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddBarcode(null)}
                className="p-1 rounded-lg text-ink-soft hover:bg-paper"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-ink-soft">
              الباركود «<b>{quickAddBarcode}</b>» غير مسجل في قاعدة البيانات. أدخل تفاصيل المنتج الأساسية لإضافته وتضمينه فوراً في الفاتورة:
            </p>

            <form onSubmit={handleSaveQuickProduct} className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-ink-soft mb-1">اسم المنتج التجاري *</label>
                <input
                  type="text"
                  required
                  value={quickAddForm.name}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, name: e.target.value })}
                  placeholder="مثال: شاحن سريع 20 وات أنكر..."
                  className="w-full p-2.5 rounded-xl bg-paper border border-line text-ink outline-none focus:border-emerald-600 font-bold"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-ink-soft mb-1">الباركود المسجل</label>
                  <input
                    type="text"
                    value={quickAddForm.barcode}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, barcode: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-paper border border-line text-ink font-mono"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1">القسم</label>
                  <select
                    value={quickAddForm.categoryId}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, categoryId: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-paper border border-line text-ink outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-ink-soft mb-1">سعر البيع *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={quickAddForm.price}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, price: e.target.value })}
                    placeholder="0"
                    className="w-full p-2.5 rounded-xl bg-paper border border-line text-ink font-mono"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1">سعر التكلفة</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={quickAddForm.costPrice}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, costPrice: e.target.value })}
                    placeholder="0"
                    className="w-full p-2.5 rounded-xl bg-paper border border-line text-ink font-mono"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1">المخزون</label>
                  <input
                    type="number"
                    min="1"
                    value={quickAddForm.stockCount}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, stockCount: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-paper border border-line text-ink font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickAddBarcode(null)}
                  className="px-4 py-2 rounded-xl bg-paper border border-line text-ink"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickProduct}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black"
                >
                  {isSavingQuickProduct ? 'جاري الحفظ...' : 'حفظ وإضافة للفاتورة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: New Customer Account Credentials Popup */}
      {newAccountCreated && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-surface border-2 border-emerald-500 shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-black text-lg text-ink">تم إنشاء حساب عميل جديد بنجاح!</h3>
              <p className="text-xs text-ink-soft">
                تم ربط هذه الفاتورة بالحساب الجديد للعميل تلقائياً، ويمكنه تسجيل الدخول فوراً
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-paper border border-line space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-soft">الاسم:</span>
                <span className="font-bold text-ink">{newAccountCreated.fullname}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-soft">اسم المستخدم / الهاتف:</span>
                <span className="font-black text-emerald-600">{newAccountCreated.username || newAccountCreated.phone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-soft">كلمة المرور الافتراضية:</span>
                <span className="font-black text-emerald-600">{newAccountCreated.tempPassword || newAccountCreated.phone}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = `أهلاً بك في متجرنا! تم تسجيل فاتورة شرائك بنجاح، وتفعيل حسابك لمتابعة مشترياتك وطلباتك:\nاسم المستخدم: ${newAccountCreated.phone}\nكلمة المرور: ${newAccountCreated.phone}`;
                    navigator.clipboard.writeText(text);
                    setCopiedAccount(true);
                    setTimeout(() => setCopiedAccount(false), 3000);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-paper border border-line text-xs font-black text-ink hover:border-emerald-500 transition-colors flex items-center justify-center gap-1.5"
                >
                  {copiedAccount ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedAccount ? 'تم نسخ البيانات' : 'نسخ بيانات الدخول'}</span>
                </button>

                <a
                  href={`https://wa.me/2${newAccountCreated.phone}?text=${encodeURIComponent(
                    `أهلاً بك في متجرنا! تم تسجيل فاتورة شرائك بنجاح، وتفعيل حسابك لمتابعة مشترياتك وطلباتك:\nاسم المستخدم: ${newAccountCreated.phone}\nكلمة المرور: ${newAccountCreated.phone}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5"
                >
                  <Share2 className="w-4 h-4" />
                  <span>واتساب</span>
                </a>
              </div>

              <button
                type="button"
                onClick={() => setNewAccountCreated(null)}
                className="w-full py-2.5 rounded-xl bg-paper border border-line text-xs font-black text-ink hover:bg-paper/80"
              >
                إغلاق والعودة للكاشير
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Customer Order History Modal */}
      {showHistoryModal && customerIntelligence?.recentOrders && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-surface border border-line shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-sm text-ink">
                  سجل طلبات العميل: {customerIntelligence.customer?.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-ink-soft hover:bg-paper"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {customerIntelligence.recentOrders.map((ord) => (
                <div
                  key={ord.orderId}
                  className="p-3 rounded-2xl bg-paper border border-line flex items-center justify-between text-xs font-bold"
                >
                  <div>
                    <div className="font-mono text-ink">{ord.orderId}</div>
                    <div className="text-[10px] text-ink-soft mt-0.5">
                      {new Date(ord.createdAt).toLocaleDateString('ar-EG')} • {ord.itemsCount} عناصر
                    </div>
                  </div>
                  <div className="text-left font-mono">
                    <div className="text-emerald-600 font-black">
                      {ord.total?.toLocaleString()} {currency}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-line">
                      {ord.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal (Triggered on sale completion or print preview) */}
      {completedOrder && (
        <InvoiceModal
          order={completedOrder}
          onClose={() => setCompletedOrder(null)}
          config={config}
        />
      )}

      {/* Optics Thermal Receipt Modal (80mm) */}
      {thermalReceiptOrder && (
        <OpticsThermalReceiptModal
          order={thermalReceiptOrder}
          onClose={() => setThermalReceiptOrder(null)}
          showToast={showToast}
          currency={currency}
        />
      )}

      {/* Cash Deposit Voucher Modal (استلام دفعة نقدية تحت الحساب) */}
      {isDepositModalOpen && (
        <DepositVoucherModal
          customer={customerIntelligence?.customer}
          onClose={() => setIsDepositModalOpen(false)}
          onSuccess={(voucher) => {
            // Update customer deposit in local state
            if (customerIntelligence?.customer) {
              setCustomerIntelligence({
                ...customerIntelligence,
                customer: {
                  ...customerIntelligence.customer,
                  depositBalance: voucher.depositBalance
                }
              });
            }
          }}
          authHeader={authHeader}
          showToast={showToast}
          currency={currency}
        />
      )}

      {/* Supply Request Modal (طلب توريد لصنف غير متوفر) */}
      {supplyModalItem && (
        <SupplyRequestModal
          item={supplyModalItem}
          customerName={customerName}
          customerPhone={customerPhone}
          onClose={() => setSupplyModalItem(null)}
          onConfirmSupply={(supplyData) => {
            setInvoiceItems((prev) =>
              prev.map((it) =>
                ((it.itemKey && it.itemKey === supplyModalItem.itemKey) || (!it.itemKey && it.productId === supplyModalItem.productId))
                  ? {
                      ...it,
                      isRequestedSupply: true,
                      supplierName: supplyData.supplierName,
                      supplierPhone: supplyData.supplierPhone
                    }
                  : it
              )
            );
          }}
          showToast={showToast}
        />
      )}

      {/* Dynamic Client Profile / Prescription Modal */}
      {isFullPrescriptionOpen && customerIntelligence?.customer && (
        <DynamicClientProfileModal
          customer={customerIntelligence.customer}
          onClose={() => setIsFullPrescriptionOpen(false)}
          onApplyToPos={(prof) => {
            if (prof?.matrixData) {
              const od = prof.matrixData['OD'] || {};
              const os = prof.matrixData['OS'] || {};
              setAppliedPrescription({
                rightEye: { sph: od.sph || od.SPH, cyl: od.cyl || od.CYL, axis: od.axis || od.AXIS, add: od.add || od.ADD, pd: od.pd || od.PD },
                leftEye: { sph: os.sph || os.SPH, cyl: os.cyl || os.CYL, axis: os.axis || os.AXIS, add: os.add || os.ADD, pd: os.pd || os.PD },
                ipd: prof.fieldValues?.ipd || '',
                doctorName: prof.fieldValues?.doctorName || '',
                usageType: prof.fieldValues?.usageType || ''
              });
            } else if (prof?.rightEye || prof?.leftEye) {
              setAppliedPrescription(prof);
            }
            setIsFullPrescriptionOpen(false);
            showToast('تم تطبيق بيانات الفحص على الفاتورة بنجاح');
          }}
          onSuccess={(data) => {
            if (data?.prescriptions && data.prescriptions[0]) {
              setAppliedPrescription(data.prescriptions[0]);
              setIsLabOrder(true);
              setCustomerIntelligence((prev) => {
                if (!prev?.customer) return prev;
                return {
                  ...prev,
                  customer: {
                    ...prev.customer,
                    latestPrescription: data.prescriptions[0],
                    prescriptions: data.prescriptions
                  }
                };
              });
            }
          }}
        />
      )}

      {/* Quick Add Customer Modal from POS */}
      {isAddCustomerModalOpen && (
        <AddCustomerModal
          onClose={() => setIsAddCustomerModalOpen(false)}
          authHeader={authHeader}
          showToast={showToast}
          branches={[]}
          onSuccess={(newUser) => {
            if (newUser) {
              setCustomerName(newUser.fullname);
              setCustomerPhone(newUser.phone);
            }
          }}
        />
      )}

      {/* 2D Grid Specs Picker Modal for Lens / Matrix Products */}
      <PosGridPickerModal
        isOpen={Boolean(gridPickerProduct)}
        onClose={() => setGridPickerProduct(null)}
        product={gridPickerProduct}
        categories={categories}
        appliedPrescription={appliedPrescription}
        onConfirm={(selection, qty, coords) => {
          if (Array.isArray(selection)) {
            selection.forEach((item) => {
              addItemToInvoice(item.product, item.quantity, item.coords);
            });
          } else {
            addItemToInvoice(selection || gridPickerProduct, qty, coords);
          }
        }}
      />

      {/* POS Work Order Modal */}
      {isWorkOrderModalOpen && (
        <WorkOrderModal
          isOpen={true}
          order={{
            isDraft: true,
            orderId: 'DRAFT-POS',
            customer: { name: customerName, phone: customerPhone },
            items: invoiceItems.map((it) => ({
              name: it.unitSlotLabel ? `${it.name} (${it.unitSlotLabel})` : it.name,
              productId: it.productId,
              quantity: it.quantity,
              price: it.price,
              costPrice: it.costPrice || 0,
              unitSlotKey: it.unitSlotKey || '',
              unitSlotLabel: it.unitSlotLabel || '',
              specs: it.lensSpecs || it.specs || {}
            }))
          }}
          labs={labsList}
          authHeader={authHeader}
          showToast={showToast}
          onClose={() => setIsWorkOrderModalOpen(false)}
          onSaveDraftConfig={(cfg) => {
            setPosWorkOrderConfig(cfg);
            setIsWorkOrderModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
