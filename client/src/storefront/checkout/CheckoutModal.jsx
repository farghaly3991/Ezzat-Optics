import React, { useState, useEffect } from 'react';
import { X, CreditCard, Truck, PackageCheck, MapPin, Copy, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';

export default function CheckoutModal() {
  const {
    isCheckoutOpen,
    setIsCheckoutOpen,
    cart,
    clearCart,
    cartTotal,
    discountAmount,
    couponCode,
    config,
    token,
    user,
    visitorId,
    sessionId,
    cartId
  } = useStore();

  const navigate = useNavigate();
  const [name, setName] = useState(user?.fullname || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [city, setCity] = useState('القاهرة');
  const [notes, setNotes] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('delivery'); // 'delivery' | 'pickup'
  const [paymentMethod, setPaymentMethod] = useState('cod');

  // Phase A Shipping Classes & Server Preview State
  const [shippingClasses, setShippingClasses] = useState([]);
  const [pickupConfig, setPickupConfig] = useState({
    enabled: true,
    branchName: 'الفرع الرئيسي',
    branchAddress: '',
    instructions: 'سيتم إشعارك فور جاهزية الطلب للاستلام من الفرع.'
  });
  const [selectedClassId, setSelectedClassId] = useState('');
  const [addressMatchInfo, setAddressMatchInfo] = useState(null);
  const [shippingQuote, setShippingQuote] = useState(null);
  const [isQuoting, setIsQuoting] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [completedOrder, setCompletedOrder] = useState(null);

  const currency = config?.currency || 'ج.م';

  // Load available public shipping classes & pickup config when checkout modal opens
  useEffect(() => {
    if (!isCheckoutOpen) return;
    axios
      .get('/api/store-public/shipping/options')
      .then((res) => {
        setShippingClasses(res.data?.shippingClasses || []);
        if (res.data?.pickup) {
          setPickupConfig(res.data.pickup);
          if (res.data.pickup.enabled === false && deliveryMethod === 'pickup') {
            setDeliveryMethod('delivery');
          }
        }
      })
      .catch(() => {});
  }, [isCheckoutOpen]);

  // Automatically classify customer address when address or city changes
  useEffect(() => {
    if (!isCheckoutOpen || deliveryMethod === 'pickup') {
      setAddressMatchInfo(null);
      return;
    }
    if (shippingClasses.length === 0) return;
    if (!address.trim() && !city.trim()) return;

    const timer = setTimeout(() => {
      axios
        .post('/api/store-public/shipping/classify-address', {
          address,
          city
        })
        .then((res) => {
          const data = res.data;
          setAddressMatchInfo(data);
          if (data?.matchedClass?._id) {
            setSelectedClassId(String(data.matchedClass._id));
          } else if (data?.requiresCustomerSelection) {
            setSelectedClassId('');
          }
        })
        .catch(() => {});
    }, 350);

    return () => clearTimeout(timer);
  }, [isCheckoutOpen, deliveryMethod, address, city, shippingClasses.length]);

  // Fetch authoritative server shipping quote whenever cart, deliveryMethod, address/city, or selectedClassId changes
  useEffect(() => {
    if (!isCheckoutOpen || cart.length === 0) return;

    const timer = setTimeout(() => {
      setIsQuoting(true);
      axios
        .post('/api/store-public/shipping/preview', {
          deliveryMethod,
          address,
          city,
          selectedShippingClassId: deliveryMethod === 'delivery' ? selectedClassId || undefined : undefined,
          items: cart.map((item) => ({
            productId: item.productId || item._id,
            quantity: item.quantity
          }))
        })
        .then((res) => {
          if (res.data?.quote) {
            setShippingQuote(res.data.quote);
          }
        })
        .catch(() => {})
        .finally(() => setIsQuoting(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [isCheckoutOpen, cart, deliveryMethod, address, city, selectedClassId]);

  if (!isCheckoutOpen) return null;

  const fallbackShipping =
    cartTotal >= (config?.freeShippingOver || 1000) ? 0 : config?.shippingCost || 50;
  const shippingCost =
    deliveryMethod === 'pickup'
      ? 0
      : shippingQuote?.customerShippingCharge !== undefined
      ? shippingQuote.customerShippingCharge
      : fallbackShipping;
  const total = Math.max(0, cartTotal - discountAmount + shippingCost);

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setErrorMessage('يرجى إدخال الاسم ورقم الهاتف لإتمام الطلب');
      return;
    }
    if (deliveryMethod === 'delivery' && !address.trim()) {
      setErrorMessage('يرجى إدخال العنوان التفصيلي لتوصيل الطلب');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const items = cart.map((item) => ({
        productId: item.productId || item._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image || item.images?.[0] || ''
      }));

      const payload = {
        deliveryMethod,
        selectedShippingClassId:
          deliveryMethod === 'delivery' && selectedClassId ? selectedClassId : undefined,
        customer: {
          name,
          phone,
          address:
            deliveryMethod === 'pickup'
              ? address || pickupConfig.branchAddress || pickupConfig.branchName || 'استلام من الفرع'
              : address,
          city,
          notes
        },
        items,
        subtotal: cartTotal,
        discount: discountAmount,
        shipping: shippingCost,
        total,
        couponCode,
        coupon: couponCode,
        paymentMethod,
        payment: { method: paymentMethod, paid: false },
        visitorId,
        sessionId,
        cartId
      };

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post('/api/store-orders-public/create', payload, { headers });

      if (res.data?.order) {
        setCompletedOrder(res.data.order);
        clearCart();
      } else {
        setErrorMessage('تعذر إنشاء الطلب، يرجى المحاولة مرة أخرى.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setErrorMessage(
        err.response?.data?.error || 'حدث خطأ أثناء تنفيذ الطلب. يرجى التحقق من البيانات والمحاولة مجدداً.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsCheckoutOpen(false);
    setCompletedOrder(null);
  };

  // Determine valid class options to display when classes exist
  const candidateClassOptions =
    addressMatchInfo?.candidateClasses?.length > 0
      ? addressMatchInfo.candidateClasses
      : shippingClasses;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in">
      <div
        style={{ backgroundColor: 'var(--color-surface-solid, #ffffff)' }}
        className="relative w-full max-w-full sm:max-w-2xl rounded-t-3xl sm:rounded-card shadow-2xl overflow-hidden border border-line my-0 sm:my-auto animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 text-ink max-h-[92vh] sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{ backgroundColor: 'var(--color-paper-solid, #f8fafc)' }}
          className="p-3.5 sm:p-5 border-b border-line flex items-center justify-between shrink-0"
        >
          <h3 className="text-base sm:text-lg font-black text-ink">
            {completedOrder ? 'تم تأكيد طلبك بنجاح! 🎉' : 'إتمام وتأكيد الشراء'}
          </h3>
          <button
            onClick={handleClose}
            className="p-1.5 sm:p-2 rounded-card text-ink-soft hover:text-ink hover:bg-surface border border-transparent hover:border-line transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {completedOrder ? (
          /* Order Success State */
          <div className="overflow-y-auto p-5 sm:p-10 text-center space-y-5 sm:space-y-6 flex-1 min-h-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto text-3xl sm:text-4xl shadow-inner">
              ✓
            </div>

            <div className="space-y-2">
              <h4 className="text-xl sm:text-2xl font-black text-ink">شكراً لك، تم استلام طلبك!</h4>
              <p className="text-xs sm:text-sm text-ink-soft max-w-md mx-auto">
                {completedOrder.deliveryMethod === 'pickup'
                  ? 'تم تسجيل طلب الاستلام من الفرع (بدون مصاريف شحن). سنقوم بإشعارك فور تأكيد وتجهيز الطلب للاستلام.'
                  : 'تم تسجيل طلبك بنجاح وهو الآن قيد المراجعة والتجهيز للشحن. سنقوم بالتواصل معك لتأكيد موعد التسليم.'}
              </p>
            </div>

            {/* Order Code Box */}
            <div className="p-3.5 sm:p-4 rounded-card bg-paper border border-line max-w-xs mx-auto flex items-center justify-between">
              <div className="text-right">
                <span className="text-[10px] text-ink-soft font-bold block">رقم تتبع الطلب:</span>
                <span className="font-mono font-black text-sm sm:text-base text-primary">
                  {completedOrder.orderId}
                </span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(completedOrder.orderId);
                  alert('تم نسخ رقم الطلب!');
                }}
                className="p-2 rounded-btn bg-surface text-ink hover:bg-primary/10 hover:text-primary border border-line shadow-sm"
                title="نسخ رقم الطلب"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 pt-3 sm:pt-4">
              <button
                onClick={() => {
                  handleClose();
                  navigate(`/track/${completedOrder.orderId}`);
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-btn bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] font-extrabold text-sm shadow-md"
              >
                تتبع حالة الطلب الآن
              </button>

              <button
                onClick={() => {
                  handleClose();
                  navigate('/');
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-btn bg-paper hover:bg-surface text-ink border border-line font-bold text-sm"
              >
                العودة للتسوق
              </button>
            </div>
          </div>
        ) : (
          /* Checkout Form */
          <form
            onSubmit={handlePlaceOrder}
            className="overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 flex-1 min-h-0"
          >
            {errorMessage && (
              <div className="p-3.5 rounded-card bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Delivery vs Pickup Selector */}
            {pickupConfig?.enabled !== false && (
              <div className="space-y-2.5">
                <h4 className="text-sm font-black text-ink">1. طريقة استلام الطلب</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('delivery')}
                    className={`p-3.5 rounded-card border-2 text-right flex items-center gap-3 transition-all ${
                      deliveryMethod === 'delivery'
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-line bg-paper hover:bg-surface'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-btn bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-ink">توصيل إلى العنوان (Delivery)</div>
                      <div className="text-[11px] text-ink-soft">توصيل سريع حتى باب المنزل</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('pickup')}
                    className={`p-3.5 rounded-card border-2 text-right flex items-center gap-3 transition-all ${
                      deliveryMethod === 'pickup'
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-line bg-paper hover:bg-surface'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-btn bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                      <PackageCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-ink">
                        استلام من الفرع (Pickup — شحن مجاني 0 {currency})
                      </div>
                      <div className="text-[11px] text-ink-soft">
                        {pickupConfig.branchName || 'الفرع الرئيسي'}
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Customer Details */}
            <div className="space-y-4">
              <h4 className="text-sm font-black text-ink">2. بيانات العميل والعنوان</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-ink-soft mb-1">الاسم بالكامل *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: أحمد محمد"
                    className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm text-ink outline-none focus:border-primary placeholder:text-ink-soft/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-soft mb-1">رقم الهاتف *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="مثال: 01012345678"
                    className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm text-ink outline-none focus:border-primary placeholder:text-ink-soft/50"
                  />
                </div>
              </div>

              {deliveryMethod === 'pickup' ? (
                <div className="p-3.5 rounded-card bg-emerald-500/10 border border-emerald-500/25 text-xs space-y-1">
                  <div className="font-black text-emerald-700 flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4" />
                    <span>معلومات الاستلام من الفرع ({pickupConfig.branchName}):</span>
                  </div>
                  {pickupConfig.branchAddress && (
                    <p className="font-bold text-ink">العنوان: {pickupConfig.branchAddress}</p>
                  )}
                  <p className="text-ink-soft">
                    {pickupConfig.instructions ||
                      'لا يتم احتساب أي رسوم شحن. ستتغير حالة الطلب إلى «جاهز للاستلام من الفرع» بعد التأكيد والتجهيز.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-ink-soft mb-1">
                        العنوان التفصيلي *
                      </label>
                      <input
                        type="text"
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="اسم الشارع، المركز/الحي، رقم العمارة..."
                        className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm text-ink outline-none focus:border-primary placeholder:text-ink-soft/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink-soft mb-1">
                        المدينة / المحافظة
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="القاهرة، أسيوط، الإسكندرية..."
                        className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm text-ink outline-none focus:border-primary placeholder:text-ink-soft/50"
                      />
                    </div>
                  </div>

                  {/* Shipping Class Suggestion & Selection Box */}
                  {shippingClasses.length > 0 && (
                    <div className="p-3.5 rounded-card bg-indigo-500/5 border border-indigo-500/25 space-y-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-black text-indigo-600 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" />
                          <span>فئة الشحن والتغطية الجغرافية لوجهتك:</span>
                        </span>
                        {addressMatchInfo?.matchedClass && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-black">
                            ✓ تم اقتراح الفئة تلقائياً حسب عنوانك
                          </span>
                        )}
                      </div>

                      {addressMatchInfo?.message && (
                        <p
                          className={`text-[11px] font-bold ${
                            addressMatchInfo.requiresCustomerSelection
                              ? 'text-orange-600'
                              : 'text-ink-soft'
                          }`}
                        >
                          {addressMatchInfo.message}
                        </p>
                      )}

                      <div>
                        <label className="block text-[11px] font-bold text-ink-soft mb-1">
                          يمكنك تأكيد أو تغيير فئة الشحن (يجب أن تغطي الفئة المختارة عنوان وجهتك):
                        </label>
                        <select
                          value={selectedClassId}
                          onChange={(e) => setSelectedClassId(e.target.value)}
                          className="w-full bg-surface border border-line rounded-btn p-2.5 text-xs font-bold text-ink outline-none focus:border-primary"
                        >
                          <option value="">-- اختر فئة الشحن المناسبة لوجهتك --</option>
                          {candidateClassOptions.map((cls) => (
                            <option key={cls._id} value={cls._id}>
                              {cls.name} ({cls.code}) — {cls.customerPrice} {currency}
                              {cls.coverageText ? ` | التغطية: ${cls.coverageText}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-ink-soft mb-1">
                  ملاحظات إضافية (اختياري)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أوقات التوصيل أو الاستلام المفضلة..."
                  className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm text-ink outline-none focus:border-primary placeholder:text-ink-soft/50"
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3 pt-4 border-t border-line">
              <h4 className="text-sm font-black text-ink">3. طريقة الدفع</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`p-4 rounded-card border-2 cursor-pointer flex items-center gap-3 transition-all ${
                    paymentMethod === 'cod'
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-line hover:border-line/80 bg-paper'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymethod"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-btn bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-ink">
                      {cart.some((item) => item.isService || item.categoryId?.type === 'service')
                        ? 'الدفع بعد تنفيذ الخدمة / عند الاستلام'
                        : 'الدفع عند الاستلام (COD)'}
                    </h5>
                    <p className="text-[11px] text-ink-soft">
                      {cart.some((item) => item.isService || item.categoryId?.type === 'service')
                        ? 'ادفع بعد إتمام الخدمة وتأكيد رضاك'
                        : 'ادفع نقداً عند استلام طلبك'}
                    </p>
                  </div>
                </label>

                <label
                  className={`p-4 rounded-card border-2 cursor-pointer flex items-center gap-3 transition-all ${
                    paymentMethod !== 'cod'
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-line hover:border-line/80 bg-paper'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymethod"
                    value="card"
                    checked={paymentMethod !== 'cod'}
                    onChange={() => setPaymentMethod('card')}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-btn bg-primary/15 text-primary flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-ink">Paymob (بطاقات ومحافظ)</h5>
                    <p className="text-[11px] text-ink-soft">فيزا، ماستركارد، فودافون كاش، فوري</p>
                  </div>
                </label>
              </div>

              {cart.some((item) => item.isService || item.categoryId?.type === 'service') && (
                <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-xs text-orange-800 dark:text-orange-200 font-bold flex items-center gap-2">
                  <span className="text-base">🔧</span>
                  <span>
                    يتضمن طلبك خدمات صيانة/تركيب. سيتم التواصل معك هاتفياً لتأكيد وتنسيق موعد الزيارة، والدفع بعد تنفيذ الخدمة.
                  </span>
                </div>
              )}
            </div>

            {/* Breakdown & Total Summary */}
            <div className="p-4 rounded-card bg-paper border border-line space-y-3">
              <div className="text-xs font-bold space-y-1 text-ink-soft border-b border-line pb-2.5">
                <div className="flex justify-between">
                  <span>قيمة المنتجات ({cart.length}):</span>
                  <span className="text-ink">{cartTotal?.toLocaleString()} {currency}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>الخصم:</span>
                    <span>-{discountAmount?.toLocaleString()} {currency}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>
                    رسوم الشحن{' '}
                    {deliveryMethod === 'pickup'
                      ? '(استلام من الفرع)'
                      : shippingQuote?.additiveShippingAmount > 0
                      ? `(أساسي ${shippingQuote.baseShippingAmount} + إضافي ${shippingQuote.additiveShippingAmount})`
                      : ''}
                    :
                  </span>
                  <span className="text-ink">
                    {isQuoting ? 'جاري الحساب...' : `${shippingCost?.toLocaleString()} ${currency}`}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-ink-soft font-bold block">
                    إجمالي المبلغ المطلوب دفعه:
                  </span>
                  <span className="text-2xl font-black text-primary">
                    {total?.toLocaleString()} {currency}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3.5 rounded-btn bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] font-black text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري التأكيد...' : 'تأكيد الطلب الآن 🛍️'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
