import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { TechnicianLayout } from '@/components/layout/TechnicianLayout'
import { ContractorLayout } from '@/components/layout/ContractorLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { WorkOrdersPage } from '@/pages/admin/WorkOrdersPage'
import { WorkOrderFormPage } from '@/pages/admin/WorkOrderFormPage'
import { WorkOrderAssignPage } from '@/pages/admin/WorkOrderAssignPage'
import { TechDashboard } from '@/pages/technician/TechDashboard'
import { TechOrdersPage } from '@/pages/technician/TechOrdersPage'
import { TechOrderDetailPage } from '@/pages/technician/TechOrderDetailPage'
import { RueckmeldungPage } from '@/pages/technician/RueckmeldungPage'
import { WorkOrderDetailPage } from '@/pages/admin/WorkOrderDetailPage'
import { CertificationPage } from '@/pages/admin/CertificationPage'
import { ContractorDashboard } from '@/pages/contractor/ContractorDashboard'
import { ContractorOrdersPage } from '@/pages/contractor/ContractorOrdersPage'
import { ROUTES } from '@/config/routes'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
          <Route path={ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />

          {/* Admin routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<AdminLayout />}>
              <Route path={ROUTES.ADMIN.DASHBOARD} element={<AdminDashboard />} />
              <Route path={ROUTES.ADMIN.ORDERS} element={<WorkOrdersPage />} />
              <Route path={ROUTES.ADMIN.ORDERS_NEW} element={<WorkOrderFormPage />} />
              <Route path={ROUTES.ADMIN.ORDERS_EDIT} element={<WorkOrderFormPage />} />
              <Route path={ROUTES.ADMIN.ORDERS_ASSIGN} element={<WorkOrderAssignPage />} />
              <Route path={ROUTES.ADMIN.ORDERS_DETAIL} element={<WorkOrderDetailPage />} />
              <Route path={ROUTES.ADMIN.CERTIFICATION} element={<CertificationPage />} />
            </Route>
          </Route>

          {/* Technician routes */}
          <Route element={<ProtectedRoute allowedRoles={['technician']} />}>
            <Route element={<TechnicianLayout />}>
              <Route path={ROUTES.TECHNICIAN.DASHBOARD} element={<TechDashboard />} />
              <Route path={ROUTES.TECHNICIAN.ORDERS} element={<TechOrdersPage />} />
              <Route path={ROUTES.TECHNICIAN.ORDERS_DETAIL} element={<TechOrderDetailPage />} />
              <Route path={ROUTES.TECHNICIAN.RUECKMELDUNG_FORM} element={<RueckmeldungPage />} />
            </Route>
          </Route>

          {/* Contractor routes */}
          <Route element={<ProtectedRoute allowedRoles={['contractor']} />}>
            <Route element={<ContractorLayout />}>
              <Route path={ROUTES.CONTRACTOR.DASHBOARD} element={<ContractorDashboard />} />
              <Route path={ROUTES.CONTRACTOR.ORDERS} element={<ContractorOrdersPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
