import React, { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { DEFAULT_ADMIN_PATH } from './adminNavItems';

/**
 * Admin routes (nested under `/admin`). Every section is a lazily loaded page, so the browser
 * only downloads the code of the section the admin actually opens.
 *
 *   /admin                    -> redirects to /admin/analytics
 *   /admin/analytics          -> AnalyticsPage
 *   /admin/finance/*          -> FinancePage (has its own nested sections: /admin/finance/<section>)
 *   /admin/products           -> ProductsPage
 *   ...
 *
 * Used inside <Routes> in App.jsx:   <Routes> ... {adminRoutes} </Routes>
 */

const AdminOverviewPage = lazy(() => import('./overview/AdminOverviewPage'));
const PosInvoicingPage = lazy(() => import('./pos/PosInvoicingPage'));
const AnalyticsPage = lazy(() => import('./analytics/AnalyticsPage'));
const FinancePage = lazy(() => import('./finance/FinancePage'));
const ProductsPage = lazy(() => import('./products/ProductsPage'));
const DesiredProductsPage = lazy(() => import('./desired-products/DesiredProductsPage'));
const AiInstructionsPage = lazy(() => import('./ai-instructions/AiInstructionsPage'));
const FacebookPage = lazy(() => import('./facebook/FacebookPage'));
const CategoriesPage = lazy(() => import('./categories/CategoriesPage'));
const OffersPage = lazy(() => import('./offers/OffersPage'));
const OrdersPage = lazy(() => import('./orders/OrdersPage'));
const AbandonedCartsPage = lazy(() => import('./carts/AbandonedCartsPage'));
const ReturnsPage = lazy(() => import('./returns/ReturnsPage'));
const MaintenancePage = lazy(() => import('./maintenance/MaintenancePage'));
const CouponsPage = lazy(() => import('./coupons/CouponsPage'));
const CustomersPage = lazy(() => import('./customers/CustomersPage'));
const ThemePage = lazy(() => import('./theme/ThemePage'));
const BranchesPage = lazy(() => import('./branches/BranchesPage'));
const InstallmentsPage = lazy(() => import('./installments/InstallmentsPage'));
const SettingsPage = lazy(() => import('./settings/SettingsPage'));
const AuditLogsPage = lazy(() => import('./audit/AuditLogsPage'));
const LensMatrixPage = lazy(() => import('./lens-matrix/LensMatrixPage'));
const MatrixTemplatesPage = lazy(() => import('./matrix-templates/MatrixTemplatesPage'));
const LabsPage = lazy(() => import('./labs/LabsPage'));
const ProcurementPage = lazy(() => import('./procurement/ProcurementPage'));
const AttendancePage = lazy(() => import('./attendance/AttendancePage'));
const DeveloperPage = lazy(() => import('./developer/DeveloperPage'));

export const adminRoutes = (
  <Route path="/admin" element={<AdminLayout />}>
    <Route index element={<Navigate to={DEFAULT_ADMIN_PATH} replace />} />
    <Route path="overview/*" element={<AdminOverviewPage />} />
    <Route path="pos/*" element={<PosInvoicingPage />} />
    <Route path="developer/*" element={<DeveloperPage />} />
    <Route path="analytics/*" element={<AnalyticsPage />} />
    <Route path="finance/*" element={<FinancePage />} />
    <Route path="procurement/*" element={<ProcurementPage />} />
    <Route path="attendance/*" element={<AttendancePage />} />
    <Route path="products/*" element={<ProductsPage />} />
    <Route path="lens-matrix/*" element={<LensMatrixPage />} />
    <Route path="matrix-templates/*" element={<MatrixTemplatesPage />} />
    <Route path="desired-products/*" element={<DesiredProductsPage />} />
    <Route path="ai-instructions/*" element={<AiInstructionsPage />} />
    <Route path="facebook/*" element={<FacebookPage />} />
    <Route path="categories/*" element={<CategoriesPage />} />
    <Route path="offers/*" element={<OffersPage />} />
    <Route path="orders/*" element={<OrdersPage />} />
    <Route path="labs/*" element={<LabsPage />} />
    <Route path="maintenance/*" element={<MaintenancePage />} />
    <Route path="carts/*" element={<AbandonedCartsPage />} />
    <Route path="returns/*" element={<ReturnsPage />} />
    <Route path="coupons/*" element={<CouponsPage />} />
    <Route path="customers/*" element={<CustomersPage />} />
    <Route path="theme/*" element={<ThemePage />} />
    <Route path="branches/*" element={<BranchesPage />} />
    <Route path="installments/*" element={<InstallmentsPage />} />
    <Route path="audit-logs/*" element={<AuditLogsPage />} />
    <Route path="settings/*" element={<SettingsPage />} />
    <Route path="*" element={<Navigate to={DEFAULT_ADMIN_PATH} replace />} />
  </Route>
);
