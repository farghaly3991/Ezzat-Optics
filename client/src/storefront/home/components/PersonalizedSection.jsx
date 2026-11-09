import React, { useState, useEffect } from 'react';
import { Sparkles, Compass } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';
import ProductCard from '../../../shared/components/ProductCard';

export default function PersonalizedSection() {
  const { sessionId, token, config } = useStore();
  const [recommendations, setRecommendations] = useState([]);
  const [persona, setPersona] = useState('');
  const [summary, setSummary] = useState('');
  const [engine, setEngine] = useState('');

  useEffect(() => {
    axios
      .get(`/api/store-public/recommendations?sessionId=${sessionId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      .then((res) => {
        if (res.data?.products) {
          setRecommendations(res.data.products);
          setPersona(res.data.persona || '');
          setSummary(res.data.interestSummary || '');
          setEngine(res.data.engine || 'standard');
        }
      })
      .catch((err) => console.warn('Recommendations fetch error:', err));
  }, [sessionId, token]);

  if (!recommendations || recommendations.length === 0) return null;

  return (
    <section className="my-12 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-surface border border-line shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs font-black px-3 py-1 rounded-full shadow-sm">
              <Sparkles className="w-3.5 h-3.5" /> مقترح خصيصاً لك
            </span>
            {persona && (
              <span className="text-xs font-extrabold text-ink bg-surface border border-line px-3 py-1 rounded-full">
                {persona}
              </span>
            )}
          </div>
          <h3 className="text-2xl font-black text-ink">منتجات مختارة لتلائم اهتماماتك</h3>
          {summary && (
            <p className="text-xs sm:text-sm text-ink-soft font-medium mt-1">{summary}</p>
          )}
        </div>

        <div className="text-[11px] font-bold text-ink-soft bg-surface px-3 py-1.5 rounded-btn border border-line flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-primary" />
          <span>{engine.includes('ai') ? 'تحليل دلالي بالـ AI' : 'تحليل تكرار الفئات الذكي'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {recommendations.map((prod) => (
          <div key={prod._id} className="relative">
            <ProductCard product={prod} />
            {prod.recommendationReason && (
              <div className="mt-1.5 px-2 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-md py-0.5 truncate">
                💡 {prod.recommendationReason}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
