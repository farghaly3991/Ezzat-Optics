import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { applyThemeTokens as runThemeInjector } from '../theme/themeInjector';

const StoreContext = createContext();

export function StoreProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [theme, setTheme] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('store_token') || '');

  // Stable anonymous visitor ID (persists across sessions)
  const [visitorId] = useState(() => {
    let vid = localStorage.getItem('store_visitor_id');
    if (!vid) {
      vid = 'vis_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('store_visitor_id', vid);
    }
    return vid;
  });

  // Browsing session ID
  const [sessionId] = useState(() => {
    let sid = sessionStorage.getItem('store_session_id') || localStorage.getItem('store_session_id');
    if (!sid) {
      sid = 'sid_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('store_session_id', sid);
    }
    sessionStorage.setItem('store_session_id', sid);
    return sid;
  });

  // Active Cart ID for cart-to-checkout and cart-to-order linkage
  const [cartId, setCartId] = useState(() => {
    let cid = localStorage.getItem('store_cart_id');
    if (!cid) {
      cid = 'cart_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('store_cart_id', cid);
    }
    return cid;
  });

  // Applied Coupon state shared between CartDrawer and CheckoutModal
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  // Multi-Branch Architecture State
  const [branches, setBranches] = useState([]);
  const [activeBranchIdState, setActiveBranchIdState] = useState(() => {
    return localStorage.getItem('store_active_branch') || 'all';
  });

  const isSuperAdmin = Boolean(
    user && (
      Number(user.role) === 5 ||
      user.role === 'super_admin' ||
      (user.role === 'admin' && (!user.branchId || Number(user.role) === 5))
    )
  );

  const isBranchAdmin = Boolean(
    !isSuperAdmin &&
    user && (
      Number(user.role) === 4 ||
      user.role === 'branch_admin' ||
      (Boolean(user.branchId) && Number(user.role) !== 3 && Number(user.role) !== 2)
    )
  );

  const isSalesStaff = Boolean(
    !isSuperAdmin &&
    user && (
      Number(user.role) === 3 ||
      user.role === 'sales_staff' ||
      user.role === 'staff'
    )
  );

  const isTechnician = Boolean(
    !isSuperAdmin &&
    user && (
      Number(user.role) === 2 ||
      user.role === 'maintenance_tech' ||
      user.role === 'technician'
    )
  );

  const isAdmin = Boolean(isSuperAdmin || isBranchAdmin || isSalesStaff || user?.role === 'admin');

  // Enforce branch isolation ONLY for branch-scoped staff (Super Admin is never locked)
  const isBranchScoped = Boolean(!isSuperAdmin && (isBranchAdmin || isSalesStaff || isTechnician));
  const activeBranchId = isBranchScoped && user?.branchId ? String(user.branchId) : activeBranchIdState;

  const setActiveBranchId = (bId) => {
    if (isBranchScoped) return;
    const val = String(bId || 'all');
    setActiveBranchIdState(val);
    localStorage.setItem('store_active_branch', val);
    if (val && val !== 'all') {
      axios.defaults.headers.common['x-branch-id'] = val;
    } else {
      delete axios.defaults.headers.common['x-branch-id'];
    }
  };

  const fetchBranches = async () => {
    try {
      const url = isAdmin ? '/api/admin/branches' : '/api/store-public/branches';
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(url, { headers });
      if (res.data?.branches) {
        setBranches(res.data.branches);
      }
    } catch (err) {
      console.warn('Failed to fetch branches:', err?.message);
    }
  };

  // Set default axios headers for visitor, session, and cart attribution
  useEffect(() => {
    axios.defaults.headers.common['x-visitor-id'] = visitorId;
    axios.defaults.headers.common['x-session-id'] = sessionId;
    axios.defaults.headers.common['x-cart-id'] = cartId;
  }, [visitorId, sessionId, cartId]);

  useEffect(() => {
    if (activeBranchId && activeBranchId !== 'all') {
      axios.defaults.headers.common['x-branch-id'] = activeBranchId;
    } else {
      delete axios.defaults.headers.common['x-branch-id'];
    }
  }, [activeBranchId]);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Cart & Wishlist state
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('store_cart')) || [];
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('store_wishlist')) || [];
    } catch {
      return [];
    }
  });

  // UI Drawers & Modals
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [activeProductModal, setActiveProductModal] = useState(null);
  const [waitlistProductModal, setWaitlistProductModal] = useState(null);

  const openWaitlistModal = (product) => setWaitlistProductModal(product);
  const closeWaitlistModal = () => setWaitlistProductModal(null);

  // AI Chat & Comparison
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [aiChatInitialPrompt, setAiChatInitialPrompt] = useState('');
  const [aiComparisonContext, setAiComparisonContext] = useState(null);
  const [comparisonIds, setComparisonIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('store_comparison_ids')) || [];
    } catch {
      return [];
    }
  });

  // Helper to send validated client activity events to backend
  const logActivityEvent = async (payload) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(
        '/api/store-public/activity',
        {
          ...payload,
          visitorId,
          sessionId,
          cartId
        },
        { headers }
      );
      return res.data;
    } catch (err) {
      console.warn('[ACTIVITY_LOG_WARN]', err.response?.data?.error || err.message);
      return null;
    }
  };

  const [priceFeedbackIds, setPriceFeedbackIds] = useState(() => {
    try {
      const saved = localStorage.getItem('store_price_feedback_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const hasPriceFeedback = (productId) => {
    if (!productId) return false;
    return priceFeedbackIds.includes(String(productId));
  };

  const togglePriceFeedback = async (productId) => {
    if (!productId) return false;
    const idStr = String(productId);
    try {
      const res = await axios.post('/api/store-public/price-feedback/toggle', { productId: idStr });
      if (res.data?.active) {
        const nextIds = Array.from(new Set([...priceFeedbackIds, idStr]));
        setPriceFeedbackIds(nextIds);
        localStorage.setItem('store_price_feedback_ids', JSON.stringify(nextIds));
        showToast(res.data.message || 'تم إرسال ملاحظتك بأن السعر مرتفع لإدارة المتجر، شكراً لك! 💬');
        return true;
      } else {
        const nextIds = priceFeedbackIds.filter((id) => id !== idStr);
        setPriceFeedbackIds(nextIds);
        localStorage.setItem('store_price_feedback_ids', JSON.stringify(nextIds));
        showToast(res.data?.message || 'تم إلغاء ملاحظة السعر المرتفع');
        return false;
      }
    } catch (err) {
      console.warn('[PRICE_FEEDBACK_ERR]', err);
      // Fallback local toggle
      const wasActive = priceFeedbackIds.includes(idStr);
      const nextIds = wasActive
        ? priceFeedbackIds.filter((id) => id !== idStr)
        : [...priceFeedbackIds, idStr];
      setPriceFeedbackIds(nextIds);
      localStorage.setItem('store_price_feedback_ids', JSON.stringify(nextIds));
      showToast(wasActive ? 'تم إلغاء ملاحظة السعر المرتفع' : 'تم إرسال ملاحظتك بأن السعر مرتفع لإدارة المتجر 💬');
      return !wasActive;
    }
  };

  const submitPriceFeedback = togglePriceFeedback;

  const addToComparison = (productId) => {
    const idStr = String(productId);
    if (!comparisonIds.includes(idStr)) {
      if (comparisonIds.length >= 4) {
        showToast('الحد الأقصى للمقارنة هو 4 منتجات في وقت واحد', 'error');
        return;
      }
      const updated = [...comparisonIds, idStr];
      setComparisonIds(updated);
      localStorage.setItem('store_comparison_ids', JSON.stringify(updated));
      showToast('تمت إضافة المنتج لقائمة المقارنة ⚖️');
    }
  };

  const removeFromComparison = (productId) => {
    const idStr = String(productId);
    const updated = comparisonIds.filter((id) => id !== idStr);
    setComparisonIds(updated);
    localStorage.setItem('store_comparison_ids', JSON.stringify(updated));
    showToast('تمت إزالة المنتج من المقارنة');
  };

  const clearComparison = () => {
    setComparisonIds([]);
    localStorage.removeItem('store_comparison_ids');
  };

  const isInComparison = (productId) => comparisonIds.includes(String(productId));

  const openAiChatWithPrompt = (promptText = '') => {
    setAiChatInitialPrompt(promptText);
    setIsAiChatOpen(true);
  };

  const openAiComparisonChat = (comparisonData) => {
    setAiComparisonContext(comparisonData);
    setIsAiChatOpen(true);
  };

  // Active Toast notifications
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Sync cart to localStorage & backend
  useEffect(() => {
    localStorage.setItem('store_cart', JSON.stringify(cart));

    const syncTimer = setTimeout(() => {
      if (cartId) {
        axios
          .post('/api/store-public/cart/sync', {
            cartId,
            items: cart,
            couponCode: appliedCoupon?.code || '',
            discountAmount: appliedCoupon?.discountAmount || 0,
            customer: {
              name: user?.fullname || user?.username || '',
              phone: user?.phone || '',
              email: user?.email || ''
            }
          })
          .catch((err) => {
            console.debug('[CART_SYNC_DEBUG]', err.message);
          });
      }
    }, 800);

    return () => clearTimeout(syncTimer);
  }, [cart, cartId, appliedCoupon, user]);

  // Sync wishlist to localStorage
  useEffect(() => {
    localStorage.setItem('store_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  // Sync comparisonIds to localStorage
  useEffect(() => {
    localStorage.setItem('store_comparison_ids', JSON.stringify(comparisonIds));
  }, [comparisonIds]);

  // Apply Theme CSS variables dynamically via Manara Theme Injector
  const applyThemeTokens = (themeObj) => {
    if (!themeObj) return;
    runThemeInjector(themeObj);
    setTheme(themeObj);
  };

  // Load public config from server
  const loadConfig = async () => {
    try {
      const res = await axios.get('/api/store-public/config');
      if (res.data?.config) {
        setConfig(res.data.config);
        if (res.data.config.customTheme) {
          applyThemeTokens(res.data.config.customTheme);
        }
      }
    } catch (err) {
      console.error('Failed to load store config:', err);
    }
  };

  // Check auth user if token exists
  const loadMe = async (authToken) => {
    if (!authToken) return;
    try {
      const res = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.data?.user) {
        setUser(res.data.user);
        if (Array.isArray(res.data.user.wishlist)) {
          setWishlist(res.data.user.wishlist.map(String));
        }
      }
    } catch {
      localStorage.removeItem('store_token');
      setToken('');
      setUser(null);
    }
  };

  useEffect(() => {
    loadConfig();
    fetchBranches();
    if (token) loadMe(token);
  }, []);

  useEffect(() => {
    if (user) {
      fetchBranches();
    }
  }, [user]);

  // Login handler
  const loginUser = (userObj, tokenStr) => {
    localStorage.setItem('store_token', tokenStr);
    setToken(tokenStr);
    setUser(userObj);
    setIsAuthOpen(false);
    showToast(`مرحباً بك مجدداً، ${userObj.fullname || ''}!`);
  };

  // Logout handler
  const logoutUser = () => {
    localStorage.removeItem('store_token');
    setToken('');
    setUser(null);
    showToast('تم تسجيل الخروج بنجاح');
  };

  // Cart operations
  const addToCart = (product, quantity = 1) => {
    if (!product || !product._id) return;
    const isService =
      product.isService === true ||
      product.categoryId?.type === 'service' ||
      (typeof product.categoryId === 'string' && product.categoryType === 'service');

    const existing = cart.find(
      (item) => String(item.productId || item._id) === String(product._id)
    );

    if (isService && existing) {
      showToast(`خدمة «${product.name}» مضافة بالفعل إلى طلبك`, 'info');
      return;
    }

    const qty = isService ? 1 : Math.max(1, Number(quantity || 1));
    setCart((prev) => {
      const existingInPrev = prev.find(
        (item) => String(item.productId || item._id) === String(product._id)
      );
      if (existingInPrev) {
        if (isService) {
          return prev;
        }
        return prev.map((item) =>
          String(item.productId || item._id) === String(product._id)
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          _id: product._id,
          name: product.name,
          price: product.price,
          image: product.images?.[0] || '',
          quantity: qty,
          stockCount: product.stockCount,
          categoryId: product.categoryId,
          isService: Boolean(isService),
          linkedItemIds: product.linkedItemIds || []
        }
      ];
    });
    showToast(isService ? `تمت إضافة خدمة «${product.name}» إلى سلة طلبك!` : `تمت إضافة «${product.name}» إلى سلة التسوق!`);
    logActivityEvent({
      eventType: 'add_to_cart',
      productId: product._id,
      quantity: qty,
      couponCode: appliedCoupon?.code || null,
      couponApplied: Boolean(appliedCoupon?.code)
    });
  };

  const removeFromCart = (productId) => {
    const existing = cart.find((i) => String(i.productId || i._id) === String(productId));
    setCart((prev) => prev.filter((i) => String(i.productId || i._id) !== String(productId)));
    if (existing) {
      logActivityEvent({
        eventType: 'remove_from_cart',
        productId,
        quantity: existing.quantity || 1
      });
    }
  };

  const updateQty = (productId, newQty) => {
    if (newQty <= 0) return removeFromCart(productId);
    const existing = cart.find((i) => String(i.productId || i._id) === String(productId));
    if ((existing?.isService || existing?.categoryId?.type === 'service') && newQty > 1) {
      showToast('الخدمات تُحجز مرة واحدة فقط لكل طلب', 'info');
      return;
    }
    setCart((prev) =>
      prev.map((i) =>
        String(i.productId || i._id) === String(productId)
          ? { ...i, quantity: (existing?.isService || existing?.categoryId?.type === 'service') ? 1 : newQty }
          : i
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
    const nextCid = 'cart_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    localStorage.setItem('store_cart_id', nextCid);
    setCartId(nextCid);
  };

  const cartSubtotal = cart.reduce((acc, it) => acc + (it.price || 0) * (it.quantity || 1), 0);
  const cartCount = cart.reduce((acc, it) => acc + (it.quantity || 1), 0);

  // Wishlist operations
  const toggleWishlist = async (productId) => {
    const pIdStr = String(productId);
    const inList = wishlist.includes(pIdStr);
    const nextList = inList ? wishlist.filter((id) => id !== pIdStr) : [...wishlist, pIdStr];
    setWishlist(nextList);

    showToast(inList ? 'تم الحذف من المفضلة' : 'تمت الإضافة إلى المفضلة ❤️');

    if (token) {
      try {
        await axios.post(
          '/api/auth/wishlist/toggle',
          { productId, visitorId, sessionId, cartId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (err) {
        console.error('Error syncing wishlist with backend:', err);
      }
    } else {
      // Record anonymous visitor wishlist event in Activity
      logActivityEvent({
        eventType: inList ? 'wishlist_removed' : 'wishlist_added',
        productId
      });
    }
  };

  const isInWishlist = (productId) => wishlist.includes(String(productId));

  // Client Behavior Tracking: Fast-Start + Immediate First View + Small Batch (2 items)
  // Eliminates the 5-item buffer trap so recommendations start immediately!
  const sendEnrichmentBatch = (itemsToSend) => {
    if (!itemsToSend || itemsToSend.length === 0) return;
    axios
      .post(
        '/api/store-public/client-profile/enrich',
        { sessionId, items: itemsToSend },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
      .then(() => {
        localStorage.setItem('store_profile_initialized', 'true');
      })
      .catch((err) => {
        console.warn('[CLIENT_PROFILE_ENRICH_WARN]', err.message);
      });
  };

  const trackProductView = (product, recordBackendView = false) => {
    if (!product || !product._id) return;

    if (recordBackendView) {
      logActivityEvent({
        eventType: 'product_viewed',
        productId: product._id
      });
    }

    const itemRecord = {
      productId: product._id,
      name: product.name,
      categoryId: product.categoryId?._id || product.categoryId,
      categoryName: product.categoryId?.name || '',
      price: product.price,
      tags: product.tags || [],
      specs: product.specs || {}
    };

    const isInitialized = localStorage.getItem('store_profile_initialized') === 'true';

    // Fast-Start: If new user / uninitialized profile, flush their very first view immediately!
    if (!isInitialized) {
      sendEnrichmentBatch([itemRecord]);
      localStorage.setItem('store_browsing_buffer', JSON.stringify([]));
      return;
    }

    let buffer = [];
    try {
      buffer = JSON.parse(localStorage.getItem('store_browsing_buffer')) || [];
    } catch {
      buffer = [];
    }

    buffer.push(itemRecord);

    // Buffer threshold reduced to 2 items for rapid adaptation
    if (buffer.length >= 2) {
      sendEnrichmentBatch(buffer);
      buffer = [];
    }

    localStorage.setItem('store_browsing_buffer', JSON.stringify(buffer));
  };

  // Track search filter events without requiring a product click
  const trackSearchFilter = ({ categoryId = null, categoryName = '', specFilters = {}, minPrice = null, maxPrice = null, query = '' }) => {
    if (!categoryId && !query && (!specFilters || Object.keys(specFilters).length === 0)) return;

    axios
      .post(
        '/api/store-public/client-profile/filter',
        {
          sessionId,
          categoryId,
          categoryName,
          specFilters,
          minPrice,
          maxPrice,
          query
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
      .catch((err) => {
        console.warn('[SEARCH_FILTER_TRACK_WARN]', err.message);
      });
  };

  // ============================================================================
  // Variant Grouping & Sibling Cache in Store Management (Prevents Server Re-Grouping)
  // ============================================================================
  const [adminGroupsCache, setAdminGroupsCache] = useState({});
  const [variantGroupsCache, setVariantGroupsCache] = useState({});
  const [productDetailsCache, setProductDetailsCache] = useState({});

  const fetchAdminProductGroups = async (categoryId = '', forceRefresh = false) => {
    if (!token) return [];
    const cacheKey = categoryId ? String(categoryId) : 'all';

    if (!forceRefresh && adminGroupsCache[cacheKey]) {
      return adminGroupsCache[cacheKey];
    }

    // If 'all' is already cached and !forceRefresh, we can also derive category groups locally
    if (!forceRefresh && categoryId && adminGroupsCache.all) {
      const filtered = adminGroupsCache.all
        .map((g) => {
          const matchingProds = (g.products || []).filter(
            (p) => String(p.categoryId?._id || p.categoryId) === String(categoryId)
          );
          if (matchingProds.length === 0) return null;
          return {
            ...g,
            count: matchingProds.length,
            sampleProduct: matchingProds[0],
            products: matchingProds
          };
        })
        .filter(Boolean);
      setAdminGroupsCache((prev) => ({ ...prev, [cacheKey]: filtered }));
      return filtered;
    }

    try {
      const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
      const res = await axios.get(`/api/admin/products/groups${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const groups = res.data?.groups || [];
      setAdminGroupsCache((prev) => ({ ...prev, [cacheKey]: groups }));
      return groups;
    } catch (err) {
      console.error('Failed to fetch product groups:', err);
      return [];
    }
  };

  const invalidateAdminGroupsCache = () => {
    setAdminGroupsCache({});
    setVariantGroupsCache({});
    setProductDetailsCache({});
  };

  const fetchCachedProductDetails = async (productId, forceRefresh = false) => {
    const idStr = String(productId);
    if (!forceRefresh && productDetailsCache[idStr]) {
      return productDetailsCache[idStr];
    }

    const res = await axios.get(`/api/store-public/product/${idStr}`);
    const data = res.data;
    if (data?.product) {
      const groupCode = String(data.product.groupCode || '').trim();
      const siblings = Array.isArray(data.siblings) ? data.siblings : [];

      setProductDetailsCache((prev) => {
        const next = { ...prev, [idStr]: data };
        // Also pre-cache all sibling products of this groupCode so switching variants is instantaneous!
        if (groupCode && siblings.length > 0) {
          siblings.forEach((sib) => {
            const sibId = String(sib._id);
            if (!next[sibId]) {
              next[sibId] = {
                ...data,
                product: sib,
                siblings
              };
            }
          });
        }
        return next;
      });

      if (groupCode && siblings.length > 0) {
        setVariantGroupsCache((prev) => ({
          ...prev,
          [groupCode]: {
            groupCode,
            siblings,
            updatedAt: Date.now()
          }
        }));
      }
    }
    return data;
  };

  return (
    <StoreContext.Provider
      value={{
        config,
        loadConfig,
        theme,
        applyThemeTokens,
        user,
        token,
        loginUser,
        logoutUser,
        cart,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        cartSubtotal,
        cartTotal: cartSubtotal,
        cartCount,
        appliedCoupon,
        setAppliedCoupon,
        discountAmount: appliedCoupon?.discountAmount || 0,
        couponCode: appliedCoupon?.code || '',
        wishlist,
        setWishlist,
        toggleWishlist,
        isInWishlist,
        isCartOpen,
        setIsCartOpen,
        isWishlistOpen,
        setIsWishlistOpen,
        isAuthOpen,
        setIsAuthOpen,
        isCheckoutOpen,
        setIsCheckoutOpen,
        activeProductModal,
        setActiveProductModal,
        waitlistProductModal,
        setWaitlistProductModal,
        openWaitlistModal,
        closeWaitlistModal,
        trackProductView,
        trackSearchFilter,
        logActivityEvent,
        submitPriceFeedback,
        togglePriceFeedback,
        hasPriceFeedback,
        priceFeedbackIds,
        visitorId,
        sessionId,
        cartId,
        showToast,
        isAiChatOpen,
        setIsAiChatOpen,
        aiChatInitialPrompt,
        setAiChatInitialPrompt,
        openAiChatWithPrompt,
        aiComparisonContext,
        setAiComparisonContext,
        openAiComparisonChat,
        comparisonIds,
        setComparisonIds,
        addToComparison,
        removeFromComparison,
        clearComparison,
        isInComparison,
        adminGroupsCache,
        fetchAdminProductGroups,
        invalidateAdminGroupsCache,
        variantGroupsCache,
        productDetailsCache,
        fetchCachedProductDetails,
        branches,
        activeBranchId,
        setActiveBranchId,
        fetchBranches,
        isSuperAdmin,
        isBranchAdmin,
        isSalesStaff,
        isTechnician,
        isAdmin
      }}
    >
      {children}

      {/* Global Toast Notifications */}
      <div className="fixed bottom-5 left-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-btn shadow-2xl font-bold text-sm transform transition-all duration-300 ${
              t.type === 'error' ? 'bg-red-600 text-white' : 'bg-surface border border-line text-ink'
            }`}
          >
            <span>{t.type === 'error' ? '⚠️' : '✨'}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
