import React from 'react';
import { Sparkles, Clock, ArrowLeft } from 'lucide-react';
import ProductCard from '../../../shared/components/ProductCard';

export default function OffersSection({ offers = [] }) {
  if (!offers || offers.length === 0) return null;

  return (
    <section className="space-y-8 my-12">
      {offers.map((offer) => {
        const remainingDays = Math.max(
          0,
          Math.ceil((new Date(offer.endDate) - new Date()) / (1000 * 60 * 60 * 24))
        );

        return (
          <div
            key={offer._id}
            className="rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden border border-primary/20"
            style={{
              background: offer.bannerImage
                ? `url(${offer.bannerImage}) center/cover no-repeat`
                : offer.bgColor || `linear-gradient(to right, var(--color-primary), var(--color-secondary))`
            }}
          >
            <div className="absolute inset-0 bg-black/40 z-0" />
            {/* Background Glow */}
            <div className="absolute -top-12 -left-12 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl pointer-events-none z-0" />

            {/* Offer Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-orange-500 text-slate-950 text-xs font-black px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> {offer.badge || 'عرض خاص'}
                  </span>
                  <span className="bg-white/10 backdrop-blur-md text-orange-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 border border-white/10">
                    <Clock className="w-3.5 h-3.5" /> متبقي {remainingDays} يوم على انتهاء العرض
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-black">{offer.title}</h3>
                {offer.description && (
                  <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
                    {offer.description}
                  </p>
                )}
              </div>
            </div>

            {/* Products inside this offer */}
            {offer.productIds && offer.productIds.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 relative z-10">
                {offer.productIds.map((prod) => (
                  <ProductCard key={prod._id} product={prod} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
