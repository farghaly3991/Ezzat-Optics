import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingBag,
  Heart,
  Search,
  User,
  Sparkles,
  Menu,
  X,
  Truck,
  ShieldCheck,
  Zap,
  LogOut,
  SlidersHorizontal,
  ChevronDown,
  Package,
  Scale,
  Bot,
  Bell,
  CheckCheck,
  ScanBarcode,
  Wrench,
  Mic
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../context/StoreContext';
import { useGeminiVoiceInput } from '../utils/useGeminiVoiceInput';

export default function Navbar() {
  const {
    config,
    cartCount,
    wishlist,
    user,
    logoutUser,
    setIsCartOpen,
    setIsWishlistOpen,
    setIsAuthOpen,
    setActiveProductModal,
    setIsAiChatOpen,
    visitorId,
    comparisonIds = [],
    isAdmin,
    isSuperAdmin,
    isBranchAdmin,
    isSalesStaff,
    isTechnician,
    showToast
  } = useStore();

  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = location.pathname;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const {
    isListening: isVoiceSearching,
    isProcessing: isVoiceProcessing,
    toggleVoice: toggleVoiceSearch
  } = useGeminiVoiceInput({
    contextHint: 'search',
    onTranscript: (transcript, provider) => {
      setSearchQuery(transcript);
      if (showToast) {
        const src = provider === 'gemini' ? 'Gemini Audio' : 'متصفح الويب';
        showToast(`🎙️ بحث صوتي (${src}): «${transcript}»`);
      }
    },
    onError: (msg) => {
      if (showToast) showToast(msg, 'error');
    }
  });
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const searchRef = useRef(null);
  const notifRef = useRef(null);

  // Fetch in-app notifications
  const fetchNotifications = async () => {
    try {
      const res = await axios.get('/api/store-public/notifications', {
        params: { visitorId }
      });
      setNotifications(res.data?.notifications || []);
      setUnreadNotifCount(res.data?.unreadCount || 0);
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
  }, [user, visitorId]);

  const handleOpenNotification = async (notif) => {
    try {
      await axios.post(`/api/store-public/notifications/mark-read/${notif._id}`, { visitorId });
      setUnreadNotifCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
      );
    } catch {}
    setIsNotifOpen(false);
    if (notif.link) {
      navigate(notif.link);
    } else if (notif.productId) {
      navigate(`/product/${notif.productId}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.post('/api/store-public/notifications/mark-read-all', { visitorId });
      setUnreadNotifCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

  // Live search debounced
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await axios.get(`/api/store-public/search?query=${encodeURIComponent(searchQuery.trim())}&limit=6`);
        if (res.data?.products) {
          setSearchResults(res.data.products);
          setShowSearchDropdown(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProduct = (product) => {
    setActiveProductModal(product);
    setShowSearchDropdown(false);
    setSearchQuery('');
  };

  const isAi = config?.isAiAvailable;

  const isActive = (path) => {
    if (path === '/' && currentPage === '/') return true;
    if (path !== '/' && currentPage.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-50 glass-nav transition-all duration-300 w-full border-b border-line/60 bg-white/95 backdrop-blur-md">
      {/* Clean System Navigation Header (No clutter, Focused on Search, Catalog, Compare & Admin) */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-3 sm:gap-6">
          {/* Brand Logo */}
          <Link
            to="/admin/overview"
            className="flex items-center gap-2.5 text-right focus:outline-none group shrink-0"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-lg font-black shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform shrink-0">
              👓
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-tight">
                Ezzat Optics
              </h1>
              <p className="text-[10px] text-slate-500 font-bold hidden sm:block">
                نظام إدارة البصريات والمبيعات
              </p>
            </div>
          </Link>

          {/* Search Bar */}
          <div ref={searchRef} className="flex-1 max-w-xl relative">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchResults.length) setShowSearchDropdown(true); }}
                placeholder="بحث سريع عن إطار، شنبر، عدسة، كود أو باركود..."
                className="w-full bg-slate-100 hover:bg-slate-200/70 focus:bg-white text-slate-800 placeholder:text-slate-400 rounded-xl pl-9 pr-10 py-2 text-xs sm:text-sm font-medium border border-slate-200 focus:border-blue-600 transition-all outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />

              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isSearching && (
                  <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                )}
                <button
                  type="button"
                  onClick={toggleVoiceSearch}
                  disabled={isVoiceProcessing}
                  className={`p-1 rounded-lg text-slate-400 hover:text-blue-600 transition-colors ${
                    isListening ? 'text-red-500 animate-pulse' : ''
                  }`}
                  title="بحث صوتي"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Search Dropdown */}
            {showSearchDropdown && searchResults.length > 0 && (
              <div
                style={{ backgroundColor: 'var(--color-surface-solid, #ffffff)' }}
                className="absolute left-0 right-0 mt-2 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 text-slate-800 animate-in fade-in"
              >
                <div className="p-2 divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {searchResults.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => {
                        setShowSearchDropdown(false);
                        setActiveProductModal(item);
                      }}
                      className="p-2 hover:bg-slate-50 flex items-center gap-3 cursor-pointer rounded-xl transition-colors"
                    >
                      {item.image && (
                        <img src={item.image} alt="" className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{item.sku || item.barcode || '—'}</div>
                      </div>
                      <div className="text-xs font-black text-blue-600 font-mono">
                        {item.price} {config?.currency || 'ج.م'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick System Links: Catalog, Compare, POS / Admin */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Catalog */}
            <Link
              to="/catalog"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
              title="كتالوج المنتجات"
            >
              <Package className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">الكتالوج</span>
            </Link>

            {/* Compare Products */}
            <Link
              to="/compare"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors relative"
              title="مقارنة المنتجات"
            >
              <Scale className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">المقارنة</span>
              {comparisonIds?.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center">
                  {comparisonIds.length}
                </span>
              )}
            </Link>

            {/* Direct Dashboard Button */}
            <Link
              to="/admin/overview"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-500/20 active:scale-95 transition-all"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>لوحة التحكم</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
