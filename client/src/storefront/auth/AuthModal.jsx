import React, { useState } from 'react';
import { X, Mail, Lock, User, Phone, MapPin, LogIn, UserPlus } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';

export default function AuthModal() {
  const { isAuthOpen, setIsAuthOpen, loginUser, showToast } = useStore();
  const [tab, setTab] = useState('login'); // 'login' | 'register'

  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullname, setFullname] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isAuthOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (tab === 'login') {
        const res = await axios.post('/api/auth/login', { identifier: identifier.trim(), password });
        if (res.data?.token) {
          loginUser(res.data.user, res.data.token);
          showToast(`أهلاً بك مجدداً يا ${res.data.user.fullname}!`);
          setIsAuthOpen(false);
        }
      } else {
        const res = await axios.post('/api/auth/register', {
          fullname,
          email: email.trim(),
          password,
          phone: phone.trim(),
          address: address.trim()
        });
        if (res.data?.token) {
          loginUser(res.data.user, res.data.token);
          showToast(`تم إنشاء حسابك بنجاح يا ${res.data.user.fullname}!`);
          setIsAuthOpen(false);
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.response?.data?.error || 'فشلت العملية، يرجى مراجعة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div
        style={{ backgroundColor: 'var(--color-surface-solid, #ffffff)' }}
        className="relative w-full max-w-md text-ink rounded-2xl sm:rounded-card shadow-2xl overflow-hidden border border-line my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Tabs */}
        <div
          style={{ backgroundColor: 'var(--color-paper-solid, #f8fafc)' }}
          className="p-3.5 sm:p-5 border-b border-line flex items-center justify-between"
        >
          <div className="flex bg-surface border border-line p-1 rounded-card">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`px-3 sm:px-4 py-1.5 rounded-btn text-xs font-black transition-all ${
                tab === 'login' ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm' : 'text-ink-soft hover:text-ink'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`px-3 sm:px-4 py-1.5 rounded-btn text-xs font-black transition-all ${
                tab === 'register' ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm' : 'text-ink-soft hover:text-ink'
              }`}
            >
              حساب جديد
            </button>
          </div>

          <button
            onClick={() => setIsAuthOpen(false)}
            className="p-1.5 sm:p-2 rounded-card text-ink-soft hover:text-ink hover:bg-surface border border-transparent hover:border-line transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4">
          {error && (
            <div className="p-3 rounded-btn bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold">
              ⚠️ {error}
            </div>
          )}

          {tab === 'register' && (
            <>
              <div>
                <label className="block text-xs font-bold text-ink-soft mb-1">الاسم بالكامل *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                    placeholder="محمد علي"
                    className="w-full bg-paper border border-line rounded-btn px-3 py-2 pr-9 text-sm text-ink outline-none focus:border-primary placeholder:text-ink-soft/50"
                  />
                  <User className="w-4 h-4 text-ink-soft absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-soft mb-1">رقم الهاتف *</label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01012345678"
                    className="w-full bg-paper border border-line rounded-btn px-3 py-2 pr-9 text-sm text-ink outline-none focus:border-primary placeholder:text-ink-soft/50"
                  />
                  <Phone className="w-4 h-4 text-ink-soft absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-soft mb-1">العنوان</label>
                <div className="relative">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="القاهرة، مصر"
                    className="w-full bg-paper border border-line rounded-btn px-3 py-2 pr-9 text-sm text-ink outline-none focus:border-primary placeholder:text-ink-soft/50"
                  />
                  <MapPin className="w-4 h-4 text-ink-soft absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </>
          )}

          {tab === 'login' ? (
            <div>
              <label className="block text-xs font-bold text-ink-soft mb-1">
                رقم الهاتف أو البريد الإلكتروني *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="010xxxxxxxx أو name@example.com"
                  dir="ltr"
                  className="w-full bg-paper border border-line rounded-btn px-3 py-2 pr-9 text-sm text-ink outline-none focus:border-primary placeholder:text-ink-soft/50 text-right"
                />
                <Phone className="w-4 h-4 text-ink-soft absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-ink-soft mb-1">البريد الإلكتروني (اختياري)</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com (اختياري)"
                  className="w-full bg-paper border border-line rounded-btn px-3 py-2 pr-9 text-sm text-ink outline-none focus:border-primary placeholder:text-ink-soft/50"
                />
                <Mail className="w-4 h-4 text-ink-soft absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-ink-soft mb-1">كلمة المرور *</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-paper border border-line rounded-btn px-3 py-2 pr-9 text-sm text-ink outline-none focus:border-primary placeholder:text-ink-soft/50"
              />
              <Lock className="w-4 h-4 text-ink-soft absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-btn bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] font-black text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
          >
            {tab === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'جاري الدخول...' : 'تسجيل الدخول'}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'جاري إنشاء الحساب...' : 'تأكيد التسجيل'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
