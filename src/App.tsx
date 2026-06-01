import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { AuthProvider } from '@/context/AuthContext'
import { LernmodusBodyClass } from '@/components/LernmodusBodyClass'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { TechnicianLayout } from '@/components/layout/TechnicianLayout'
import { ContractorLayout } from '@/components/layout/ContractorLayout'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ROUTES } from '@/config/routes'

// Auth chunk
const LoginPage        = lazy(() => import('@/pages/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage  = lazy(() => import('@/pages/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))

// Admin chunk (includes CertificationPage → jsPDF, largest bundle)
const AdminDashboard     = lazy(() => import('@/pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const WorkOrdersPage     = lazy(() => import('@/pages/admin/WorkOrdersPage').then(m => ({ default: m.WorkOrdersPage })))
const WorkOrderFormPage  = lazy(() => import('@/pages/admin/WorkOrderFormPage').then(m => ({ default: m.WorkOrderFormPage })))
const WorkOrderAssignPage = lazy(() => import('@/pages/admin/WorkOrderAssignPage').then(m => ({ default: m.WorkOrderAssignPage })))
const WorkOrderDetailPage = lazy(() => import('@/pages/admin/WorkOrderDetailPage').then(m => ({ default: m.WorkOrderDetailPage })))
const CertificationPage  = lazy(() => import('@/pages/admin/CertificationPage').then(m => ({ default: m.CertificationPage })))
const ServiceItemsPage   = lazy(() => import('@/pages/admin/ServiceItemsPage').then(m => ({ default: m.ServiceItemsPage })))
const ProjectsPage       = lazy(() => import('@/pages/admin/ProjectsPage').then(m => ({ default: m.ProjectsPage })))
const ProjectDetailPage  = lazy(() => import('@/pages/admin/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })))
const UsersPage          = lazy(() => import('@/pages/admin/UsersPage').then(m => ({ default: m.UsersPage })))
const PersonnelPage      = lazy(() => import('@/pages/admin/PersonnelPage').then(m => ({ default: m.PersonnelPage })))
const MaterialsPage      = lazy(() => import('@/pages/admin/MaterialsPage').then(m => ({ default: m.MaterialsPage })))
const SettingsPage       = lazy(() => import('@/pages/admin/SettingsPage').then(m => ({ default: m.SettingsPage })))

// Technician chunk (field technicians on slow connections — keep lean)
const TechDashboard      = lazy(() => import('@/pages/technician/TechDashboard').then(m => ({ default: m.TechDashboard })))
const TechOrdersPage     = lazy(() => import('@/pages/technician/TechOrdersPage').then(m => ({ default: m.TechOrdersPage })))
const TechOrderDetailPage = lazy(() => import('@/pages/technician/TechOrderDetailPage').then(m => ({ default: m.TechOrderDetailPage })))
const RueckmeldungPage   = lazy(() => import('@/pages/technician/RueckmeldungPage').then(m => ({ default: m.RueckmeldungPage })))
const TechSettingsPage   = lazy(() => import('@/pages/technician/TechSettingsPage').then(m => ({ default: m.TechSettingsPage })))

// Contractor chunk
const ContractorDashboard  = lazy(() => import('@/pages/contractor/ContractorDashboard').then(m => ({ default: m.ContractorDashboard })))
const ContractorOrdersPage = lazy(() => import('@/pages/contractor/ContractorOrdersPage').then(m => ({ default: m.ContractorOrdersPage })))
const ContractorDocumentsPage = lazy(() => import('@/pages/contractor/ContractorDocumentsPage').then(m => ({ default: m.ContractorDocumentsPage })))

function App() {
  return (
    <AuthProvider>
      <LernmodusBodyClass />
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
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
                <Route path={ROUTES.ADMIN.SERVICE_ITEMS} element={<ServiceItemsPage />} />
                <Route path={ROUTES.ADMIN.PROJECTS} element={<ProjectsPage />} />
                <Route path={ROUTES.ADMIN.PROJECTS_DETAIL} element={<ProjectDetailPage />} />
                <Route path={ROUTES.ADMIN.PERSONNEL} element={<UsersPage />} />
                <Route path={ROUTES.ADMIN.EMPLOYEES} element={<PersonnelPage />} />
                <Route path={ROUTES.ADMIN.MATERIALS} element={<MaterialsPage />} />
                <Route path={ROUTES.ADMIN.SETTINGS} element={<SettingsPage />} />
              </Route>
            </Route>

            {/* Technician routes */}
            <Route element={<ProtectedRoute allowedRoles={['technician']} />}>
              <Route element={<TechnicianLayout />}>
                <Route path={ROUTES.TECHNICIAN.DASHBOARD} element={<TechDashboard />} />
                <Route path={ROUTES.TECHNICIAN.ORDERS} element={<TechOrdersPage />} />
                <Route path={ROUTES.TECHNICIAN.ORDERS_DETAIL} element={<TechOrderDetailPage />} />
                <Route path={ROUTES.TECHNICIAN.RUECKMELDUNG_FORM} element={<RueckmeldungPage />} />
                <Route path={ROUTES.TECHNICIAN.SETTINGS} element={<TechSettingsPage />} />
              </Route>
            </Route>

            {/* Contractor routes */}
            <Route element={<ProtectedRoute allowedRoles={['contractor']} />}>
              <Route element={<ContractorLayout />}>
                <Route path={ROUTES.CONTRACTOR.DASHBOARD} element={<ContractorDashboard />} />
                <Route path={ROUTES.CONTRACTOR.ORDERS} element={<ContractorOrdersPage />} />
                <Route path={ROUTES.CONTRACTOR.DOCUMENTS} element={<ContractorDocumentsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
