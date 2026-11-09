import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './shared/context/StoreContext';
import Navbar from './shared/layout/Navbar';
import Footer from './shared/layout/Footer';
import PageLoader from './shared/components/PageLoader';
import CartDrawer from './storefront/cart/CartDrawer';
import WishlistDrawer from './storefront/cart/WishlistDrawer';
import CheckoutModal from './storefront/checkout/CheckoutModal';
import AuthModal from './storefront/auth/AuthModal';
import ProductDetailModal from './storefront/product/ProductDetailModal';
import RestockWaitlistModal from './storefront/product/components/RestockWaitlistModal';
import AiChatModal from './storefront/ai-chat/AiChatModal';
import AiChatFloatingButton from './storefront/ai-chat/AiChatFloatingButton';
import { useStore } from './shared/context/StoreContext';
import { storefrontRoutes } from './storefront/storefrontRoutes';
import { adminRoutes } from './admin/adminRoutes';

const TechnicianTaskPage = React.lazy(() => import('./maintenance/TechnicianTaskPage'));
const SupplierSupplyRequestPage = React.lazy(() => import('./storefront/supplier/SupplierSupplyRequestPage'));
const StaffPublicReviewPage = React.lazy(() => import('./storefront/reviews/StaffPublicReviewPage'));
const PublicWorkOrderTrackingPage = React.lazy(() => import('./shared/pages/PublicWorkOrderTrackingPage'));

/**
 * App shell: navbar + routed page + global drawers/modals + footer.
 *   storefront/storefrontRoutes.jsx -> customer pages
 *   admin/adminRoutes.jsx           -> /admin/* dashboard (nested routes)
 */
function AppContent() {
  const { waitlistProductModal, closeWaitlistModal } = useStore();
  const location = window.location;
  const isAdminPath = window.location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink transition-colors duration-200">
      {!isAdminPath && <Navbar />}

      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {storefrontRoutes}
            {adminRoutes}
            <Route path="/maintenance/task/:id" element={<TechnicianTaskPage />} />
            <Route path="/supplier/supply-request/:token" element={<SupplierSupplyRequestPage />} />
            <Route path="/review/staff/:token" element={<StaffPublicReviewPage />} />
            <Route path="/lab/work-order/:token" element={<PublicWorkOrderTrackingPage />} />
          </Routes>
        </Suspense>
      </main>

      {/* Global Drawers & Modals */}
      <CartDrawer />
      <WishlistDrawer />
      <CheckoutModal />
      <AuthModal />
      <ProductDetailModal />
      <RestockWaitlistModal
        product={waitlistProductModal}
        isOpen={Boolean(waitlistProductModal)}
        onClose={closeWaitlistModal}
      />
      <AiChatModal />
      <AiChatFloatingButton />

      {!isAdminPath && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </BrowserRouter>
  );
}
