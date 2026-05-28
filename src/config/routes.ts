export const ROUTES = {
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  ADMIN: {
    DASHBOARD: '/admin',
    ORDERS: '/admin/orders',
    ORDERS_NEW: '/admin/orders/new',
    ORDERS_EDIT: '/admin/orders/:id/edit',
    ORDERS_ASSIGN: '/admin/orders/:id/assign',
    ORDERS_DETAIL: '/admin/orders/:id',
    CERTIFICATION: '/admin/certification',
    SERVICE_ITEMS: '/admin/service-items',
    PROJECTS: '/admin/projects',
    PROJECTS_DETAIL: '/admin/projects/:id',
    PERSONNEL: '/admin/personnel',
    MATERIALS: '/admin/materials',
    SETTINGS: '/admin/settings',
  },

  TECHNICIAN: {
    DASHBOARD: '/tech',
    ORDERS: '/tech/orders',
    ORDERS_DETAIL: '/tech/orders/:id',
    RUECKMELDUNG: '/tech/rueckmeldung',
    RUECKMELDUNG_FORM: '/tech/orders/:id/rueckmeldung',
    SCHEDULE: '/tech/schedule',
    SETTINGS: '/tech/settings',
  },

  CONTRACTOR: {
    DASHBOARD: '/contractor',
    ORDERS: '/contractor/orders',
    DOCUMENTS: '/contractor/documents',
    CERTIFICATIONS: '/contractor/certifications',
  },
} as const
