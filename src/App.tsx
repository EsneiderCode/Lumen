import { Suspense, lazy, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { AuthProvider } from '@/context/AuthContext'
import { useTheme } from '@/hooks/useTheme'
import { LernmodusBodyClass } from '@/components/LernmodusBodyClass'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ROUTE_PERMISSIONS, hasAdminPanelAccess } from '@/config/permissions'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { TechnicianLayout } from '@/components/layout/TechnicianLayout'
import { ContractorLayout } from '@/components/layout/ContractorLayout'
import { SchedulerLayout } from '@/components/layout/SchedulerLayout'
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
const SubcontractorOnboardingPage = lazy(() => import('@/pages/admin/SubcontractorOnboardingPage').then(m => ({ default: m.SubcontractorOnboardingPage })))
const MaterialsPage      = lazy(() => import('@/pages/admin/MaterialsPage').then(m => ({ default: m.MaterialsPage })))
const CollaboratorCyclesPage = lazy(() => import('@/pages/admin/CollaboratorCyclesPage').then(m => ({ default: m.CollaboratorCyclesPage })))
const FinanceOutboxPage  = lazy(() => import('@/pages/admin/FinanceOutboxPage').then(m => ({ default: m.FinanceOutboxPage })))
const SettingsPage       = lazy(() => import('@/pages/admin/SettingsPage').then(m => ({ default: m.SettingsPage })))
const RolesPage          = lazy(() => import('@/pages/admin/RolesPage').then(m => ({ default: m.RolesPage })))
const RoleDetailPage     = lazy(() => import('@/pages/admin/RoleDetailPage').then(m => ({ default: m.RoleDetailPage })))

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
const ContractorCalendarPage = lazy(() => import('@/pages/contractor/ContractorCalendarPage').then(m => ({ default: m.ContractorCalendarPage })))

// Scheduler chunk (Terminplanung — appointments for one line + operator)
const AppointmentsListPage  = lazy(() => import('@/pages/scheduler/AppointmentsListPage').then(m => ({ default: m.AppointmentsListPage })))
const AppointmentDetailPage = lazy(() => import('@/pages/scheduler/AppointmentDetailPage').then(m => ({ default: m.AppointmentDetailPage })))
const AppointmentNewPage    = lazy(() => import('@/pages/scheduler/AppointmentNewPage').then(m => ({ default: m.AppointmentNewPage })))

// Admin route wrapped in its per-page permission guard (from ROUTE_PERMISSIONS).
function adminRoute(path: string, element: ReactNode) {
  return (
    <Route
      key={path}
      path={path}
      element={<RequirePermission permission={ROUTE_PERMISSIONS[path]}>{element}</RequirePermission>}
    />
  )
}

function App() {
  useTheme()

  return (
    <AuthProvider>
      <LernmodusBodyClass />
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
            <Route path={ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />

            {/* Admin portal — entry is derived from any admin-page permission;
                every page additionally requires its module permission */}
            <Route element={<ProtectedRoute requiredPermission={hasAdminPanelAccess} />}>
              <Route element={<AdminLayout />}>
                {adminRoute(ROUTES.ADMIN.DASHBOARD, <AdminDashboard />)}
                {adminRoute(ROUTES.ADMIN.ORDERS, <WorkOrdersPage />)}
                {adminRoute(ROUTES.ADMIN.ORDERS_NEW, <WorkOrderFormPage />)}
                {adminRoute(ROUTES.ADMIN.ORDERS_EDIT, <WorkOrderFormPage />)}
                {adminRoute(ROUTES.ADMIN.ORDERS_ASSIGN, <WorkOrderAssignPage />)}
                {adminRoute(ROUTES.ADMIN.ORDERS_DETAIL, <WorkOrderDetailPage />)}
                {adminRoute(ROUTES.ADMIN.CERTIFICATION, <CertificationPage />)}
                {adminRoute(ROUTES.ADMIN.SERVICE_ITEMS, <ServiceItemsPage />)}
                {adminRoute(ROUTES.ADMIN.PROJECTS, <ProjectsPage />)}
                {adminRoute(ROUTES.ADMIN.PROJECTS_DETAIL, <ProjectDetailPage />)}
                {adminRoute(ROUTES.ADMIN.PERSONNEL, <UsersPage />)}
                {adminRoute(ROUTES.ADMIN.EMPLOYEES, <PersonnelPage />)}
                {adminRoute(ROUTES.ADMIN.ONBOARDING, <SubcontractorOnboardingPage />)}
                {adminRoute(ROUTES.ADMIN.MATERIALS, <MaterialsPage />)}
                {adminRoute(ROUTES.ADMIN.CYCLES, <CollaboratorCyclesPage />)}
                {adminRoute(ROUTES.ADMIN.FINANCE_OUTBOX, <FinanceOutboxPage />)}
                {adminRoute(ROUTES.ADMIN.ROLES, <RolesPage />)}
                {adminRoute(ROUTES.ADMIN.ROLES_DETAIL, <RoleDetailPage />)}
                {adminRoute(ROUTES.ADMIN.SETTINGS, <SettingsPage />)}
              </Route>
            </Route>

            {/* Technician portal */}
            <Route element={<ProtectedRoute requiredPermission="portal.tech.access" />}>
              <Route element={<TechnicianLayout />}>
                <Route path={ROUTES.TECHNICIAN.DASHBOARD} element={<TechDashboard />} />
                <Route path={ROUTES.TECHNICIAN.ORDERS} element={<TechOrdersPage />} />
                <Route path={ROUTES.TECHNICIAN.ORDERS_DETAIL} element={<TechOrderDetailPage />} />
                <Route path={ROUTES.TECHNICIAN.RUECKMELDUNG_FORM} element={<RueckmeldungPage />} />
                <Route path={ROUTES.TECHNICIAN.SETTINGS} element={<TechSettingsPage />} />
              </Route>
            </Route>

            {/* Contractor portal */}
            <Route element={<ProtectedRoute requiredPermission="portal.contractor.access" />}>
              <Route element={<ContractorLayout />}>
                <Route path={ROUTES.CONTRACTOR.DASHBOARD} element={<ContractorDashboard />} />
                <Route path={ROUTES.CONTRACTOR.ORDERS} element={<ContractorOrdersPage />} />
                <Route path={ROUTES.CONTRACTOR.DOCUMENTS} element={<ContractorDocumentsPage />} />
                <Route path={ROUTES.CONTRACTOR.CALENDAR} element={<ContractorCalendarPage />} />
              </Route>
            </Route>

            {/* Scheduler portal */}
            <Route element={<ProtectedRoute requiredPermission="portal.scheduler.access" />}>
              <Route element={<SchedulerLayout />}>
                <Route path={ROUTES.SCHEDULER.APPOINTMENTS} element={<AppointmentsListPage />} />
                <Route path={ROUTES.SCHEDULER.APPOINTMENTS_NEW} element={<AppointmentNewPage />} />
                <Route path={ROUTES.SCHEDULER.APPOINTMENTS_DETAIL} element={<AppointmentDetailPage />} />
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
