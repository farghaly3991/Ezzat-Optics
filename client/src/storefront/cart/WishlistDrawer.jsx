import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Heart, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';

export default function WishlistDrawer() {
  const navigate = useNavigate();
  const {
    isWishlistOpen,
    setIsWishlistOpen,
    wishlist,
    setWishlist,
    toggleWishlist,
    addToCart,
    config
  } = useStore();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleItemClick = (item) => {
    setIsWishlistOpen(false);
    navigate(`/product/${item._id}`);
  };

  useEffect(() => {
    if (!isWishlistOpen || !Array.isArray(wishlist) || wishlist.length === 0) {
      setProducts([]);
      return;
    }

    setLoading(true);
    axios
      .post('/api/store-public/filter', {
        ids: wishlist,
        pageSize: 100,
        includeInactive: true
      })
      .then((res) => {
        if (res.data?.products) {
          const returned = res.data.products;
          setProducts(returned);

          // Auto-clean any stale/deleted IDs from wishlist so badge stays 100% accurate
          const activeIds = returned.map((p) => String(p._id));
          const cleaned = wishlist.filter((id) => activeIds.includes(String(id)));
          if (cleaned.length !== wishlist.length && typeof setWishlist === 'function') {
            setWishlist(cleaned);
          }
        } else {
          setProducts([]);
        }
      })
      .catch((err) => {
        console.error('Wishlist fetch error:', err);
        setProducts([]);
      })
      .finally(() => setLoading(false));
  }, [isWishlistOpen, wishlist.join(',')]);

  if (!isWishlistOpen) return null;

  const handleClearAll = () => {
    if (typeof setWishlist === 'function') {
      setWishlist([]);
    }
    setProducts([]);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="absolute inset-0" onClick={() => setIsWishlistOpen(false)} />

      <div className="absolute inset-y-0 left-0 max-w-full flex">
        <div
          style={{ backgroundColor: 'var(--color-surface-solid, #ffffff)' }}
          className="w-screen max-w-md text-ink shadow-2xl flex flex-col justify-between border-r border-line animate-in slide-in-from-left duration-300"
        >
          {/* Header */}
          <div
            style={{ backgroundColor: 'var(--color-paper-solid, #f8fafc)' }}
            className="p-5 border-b border-line flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500 fill-red-500" />
              <h2 className="text-lg font-black text-ink">قائمة المفضلة ({products.length})</h2>
            </div>
            <div className="flex items-center gap-1.5">
              {products.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-1"
                  title="مسح كل المنتجات من المفضلة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح الكل</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsWishlistOpen(false)}
                className="p-2 rounded-card text-ink-soft hover:text-ink hover:bg-surface border border-transparent hover:border-line transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 divide-y divide-line">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-ink-soft space-y-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold text-ink-soft">جاري تحميل عناصر المفضلة...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-ink-soft space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-paper border border-line text-red-500 flex items-center justify-center text-3xl shadow-sm">
                  ❤️
                </div>
                <div className="space-y-1">
                  <p className="text-base font-extrabold text-ink">قائمة المفضلة فارغة</p>
                  <p className="text-xs text-ink-soft">
                    انقر على رمز القلب على أي منتج لحفظه والرجوع إليه في أي وقت
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsWishlistOpen(false);
                    navigate('/catalog');
                  }}
                  className="px-5 py-2.5 rounded-btn bg-primary text-white text-xs font-black shadow-md hover:bg-primary/90 transition-all flex items-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>تصفح المنتجات في الكتالوج</span>
                </button>
              </div>
            ) : (
              products.map((item) => (
                <div key={item._id} className="py-4 flex gap-3.5 items-center">
                  <img
                    src={item.images?.[0] || 'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'}
                    alt={item.name}
                    onClick={() => handleItemClick(item)}
                    className="w-16 h-16 rounded-card object-cover bg-paper border border-line flex-shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                  />

                  <div className="flex-1 min-w-0">
                    <h4
                      onClick={() => handleItemClick(item)}
                      className="text-sm font-bold text-ink truncate cursor-pointer hover:text-primary transition-colors"
                    >
                      {item.name}
                    </h4>
                    <p className="text-xs font-black text-primary mt-0.5">
                      {item.price?.toLocaleString()} {config?.currency || 'ج.م'}
                    </p>

                    <div className="flex items-center justify-between mt-2.5">
                      {config?.storefrontMode !== 'internal_catalog' && config?.enabledModules?.carts !== false ? (
                        <button
                          type="button"
                          onClick={() => addToCart(item, 1)}
                          className="bg-primary hover:bg-primary/90 text-white text-xs font-bold px-3 py-1.5 rounded-btn flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>أضف للسلة</span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-ink-soft bg-paper px-2 py-1 rounded-md border border-line">
                          متاح للعرض بالفرع
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleWishlist(item._id)}
                        className="p-1.5 text-ink-soft hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="إزالة من المفضلة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
