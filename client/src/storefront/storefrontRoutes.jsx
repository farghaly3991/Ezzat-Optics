import React, { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';

/**
 * Customer-facing (storefront) routes. Each page is lazy loaded.
 * Used inside <Routes> in App.jsx:   <Routes> {storefrontRoutes} ... </Routes>
 */

const HomePage = lazy(() => import('./home/HomePage'));
const CatalogPage = lazy(() => import('./catalog/CatalogPage'));
const ProductPage = lazy(() => import('./product/ProductPage'));
const ComparePage = lazy(() => import('./compare/ComparePage'));
const MyOrdersPage = lazy(() => import('./orders/MyOrdersPage'));
const OrderTrackingPage = lazy(() => import('./orders/OrderTrackingPage'));
const PrivacyPolicyPage = lazy(() => import('./privacy/PrivacyPolicyPage'));

export const storefrontRoutes = (
  <>
    <Route path="/" element={<Navigate to="/admin/overview" replace />} />
    <Route path="/home" element={<HomePage />} />
    <Route path="/catalog" element={<CatalogPage />} />
    <Route path="/catalog/:catId" element={<CatalogPage />} />
    <Route path="/product/:id" element={<ProductPage />} />
    <Route path="/compare" element={<ComparePage />} />
    <Route path="/orders" element={<MyOrdersPage />} />
    <Route path="/my-orders" element={<MyOrdersPage />} />
    <Route path="/pos" element={<Navigate to="/admin/pos" replace />} />
    <Route path="/track/:orderId?" element={<OrderTrackingPage />} />
    <Route path="/privacy" element={<PrivacyPolicyPage />} />
    <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
  </>
);
