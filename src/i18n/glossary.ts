/**
 * Glosario DE→ES + explicación contextual para Lernmodus.
 * Único source of truth para el componente <T>: solo los términos
 * presentes acá muestran el icono `ⁱ` en modo aprendizaje. Mantenerlo
 * acotado a vocabulario técnico/dominio — no es un sustituto de i18n
 * para UI strings genéricos.
 */

export interface GlossaryEntry {
  es: string
  concept?: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ── Técnicos fiber ────────────────────────────────────────────────────────
  Hausanschluss: {
    es: 'Acometida domiciliaria',
    concept:
      'Conexión física del cable de fibra óptica desde la red de calle hasta el cliente final, dentro de su propiedad.',
  },
  Tiefbau: {
    es: 'Obra civil / Excavación',
    concept: 'La zanja desde la calle hasta el límite de la propiedad donde va el cable de fibra.',
  },
  Spleiße: {
    es: 'Empalme',
    concept: 'Unión de dos fibras ópticas mediante fusión, sin pérdida de señal apreciable.',
  },
  Spleißen: {
    es: 'Empalmar',
    concept: 'El proceso técnico de fusionar dos fibras ópticas.',
  },
  Einblasen: {
    es: 'Soplado del cable',
    concept:
      'Técnica para introducir el cable de fibra dentro del tubo (microducto) usando aire comprimido.',
  },
  Hausbegehung: {
    es: 'Visita técnica al cliente',
    concept:
      'Inspección previa de la vivienda para planificar la instalación: trayecto del cable, ubicación del ONT, autorizaciones.',
  },
  Glasfaser: {
    es: 'Fibra óptica',
    concept: 'La red de fibra óptica para acceso a internet de alta velocidad.',
  },
  Montage: {
    es: 'Montaje',
    concept: 'Instalación física de los componentes (ONT, cajas, conectores).',
  },
  DP: {
    es: 'Distribution Point',
    concept:
      'Punto de distribución de la red de fibra: armario o caja desde donde salen los cables hacia varios clientes.',
  },
  AP: {
    es: 'Access Point / Punto de acceso',
    concept: 'Caja externa de distribución en el extremo de la red de planta externa.',
  },
  NT: {
    es: 'Network Termination',
    concept: 'Terminación de red instalada en domicilio del cliente, antes del router.',
  },
  Patchkabel: {
    es: 'Patchcord',
    concept: 'Cable de fibra corto, pre-terminado, para conectar equipos dentro de un armario.',
  },
  Fusion: {
    es: 'Fusión de fibras',
    concept: 'Empalme por fusión térmica de dos fibras ópticas, requiere fusionadora.',
  },
  Soplado: {
    es: 'Soplado',
    concept:
      'Técnica para empujar el cable de fibra dentro del microducto con aire comprimido — uno de los tipos de trabajo registrados.',
  },

  // ── Órdenes y workflow ────────────────────────────────────────────────────
  Auftrag: { es: 'Orden de trabajo' },
  Aufträge: { es: 'Órdenes de trabajo' },
  Auftragsnummer: {
    es: 'Número de orden',
    concept: 'Identificador único de cada orden de instalación dentro de un proyecto.',
  },
  Rückmeldung: {
    es: 'Reporte de campo',
    concept:
      'Informe que el técnico envía después de ejecutar el trabajo: mediciones, fotos, observaciones. Requisito para certificar.',
  },
  Rückmeldungen: {
    es: 'Reportes de campo',
  },
  Zertifizierung: {
    es: 'Certificación',
    concept:
      'Validación formal del trabajo ejecutado: primero interna (Nexus) y después externa (cliente). Requisito para facturar.',
  },
  Zertifiziert: { es: 'Certificado' },
  Abnahme: {
    es: 'Aceptación del cliente',
    concept: 'Confirmación del cliente final de que el trabajo está conforme.',
  },
  Fakturierung: {
    es: 'Facturación',
    concept: 'Emisión de la factura al cliente. Solo posible tras la certificación externa.',
  },
  Fakturiert: { es: 'Facturado' },
  Bezahlt: { es: 'Pagado' },
  Storniert: { es: 'Cancelado' },
  Ausgeführt: { es: 'Ejecutado' },
  'In Arbeit': { es: 'En ejecución' },
  Zugewiesen: { es: 'Asignado' },
  Erstellt: { es: 'Creado' },
  Abliefern: {
    es: 'Entrega pendiente',
    concept: 'Estado de la orden cuando el trabajo está listo para ser entregado al cliente.',
  },
  Arbeitsvorbereitung: {
    es: 'Preparación del trabajo',
    concept: 'Planificación previa a la ejecución: materiales, permisos, equipo asignado.',
  },

  // ── Catálogo y datos maestros ────────────────────────────────────────────
  Projekt: {
    es: 'Proyecto',
    concept:
      'Agrupa órdenes de trabajo bajo un mismo contrato/zona (HXT, RSD, WCB, QFF, …). Pertenece a un cliente.',
  },
  Projekte: { es: 'Proyectos' },
  Katalog: { es: 'Catálogo' },
  'Service-Katalog': {
    es: 'Catálogo de servicios',
    concept:
      'Lista maestra de tareas facturables con precio interno y precio para colaboradores externos.',
  },
  Operator: {
    es: 'Operador',
    concept:
      'Empresa que opera la red (DGF, GFP, UGG). Las órdenes pertenecen a un operador específico.',
  },
  Kunden: { es: 'Clientes' },
  Kunde: {
    es: 'Cliente',
    concept:
      'Empresa contratante del trabajo (Insyte Deutschland, Vancom IT). No confundir con el cliente final del Hausanschluss.',
  },
  Material: { es: 'Materiales' },
  Personal: { es: 'Personal / Recursos humanos' },

  // ── Roles y equipos ──────────────────────────────────────────────────────
  Techniker: { es: 'Técnico' },
  Subunternehmer: {
    es: 'Subcontratista',
    concept:
      'Colaborador externo. Requiere documentación válida (Gewerbeanmeldung, Haftpflicht, …) antes de poder ser asignado.',
  },
  Admin: { es: 'Administrador' },
  Team: { es: 'Equipo' },
  Rot: { es: 'Rojo' },
  Grün: { es: 'Verde' },
  Blau: { es: 'Azul' },
  Gelb: { es: 'Amarillo' },

  // ── Compliance alemana ───────────────────────────────────────────────────
  Gewerbeanmeldung: {
    es: 'Registro mercantil',
    concept: 'Inscripción del autónomo o empresa en la cámara de comercio alemana.',
  },
  Haftpflichtversicherung: {
    es: 'Seguro de responsabilidad civil',
    concept: 'Cobertura obligatoria de daños a terceros durante el ejercicio profesional.',
  },
  Unbedenklichkeitsbescheinigung: {
    es: 'Certificado de no objeción',
    concept:
      'Documento del Finanzamt o Sozialkasse confirmando que no hay deudas tributarias o de seguridad social.',
  },
  Finanzamt: { es: 'Hacienda alemana' },
  Sozialkasse: { es: 'Caja de seguridad social' },
  Gehaltsabrechnung: {
    es: 'Nómina',
    concept:
      'Recibo de sueldo mensual con desglose Lohnsteuer + Soli + seguros médicos/pensiones/desempleo.',
  },
  Lohnsteuer: { es: 'Retención IRPF' },
  Solidaritätszuschlag: { es: 'Recargo de solidaridad' },
  Steuerklasse: {
    es: 'Clase fiscal',
    concept:
      'Categoría tributaria alemana (I–VI) que determina la retención según estado civil y situación familiar.',
  },
  Urlaubsverwaltung: {
    es: 'Gestión de vacaciones',
    concept: 'Mínimo legal alemán: 20 días por año según el BUrlG.',
  },
  'SV-Nummer': {
    es: 'Número de seguridad social',
    concept: 'Sozialversicherungsnummer — identificador único en el sistema alemán de pensiones.',
  },
  'Steuer-ID': {
    es: 'ID fiscal personal',
    concept: 'Steueridentifikationsnummer — 11 dígitos asignados de por vida.',
  },

  // ── Navegación ───────────────────────────────────────────────────────────
  Übersicht: { es: 'Resumen / Vista general' },
  Einstellungen: { es: 'Configuración' },
  Abmelden: { es: 'Cerrar sesión' },
  Anmelden: { es: 'Iniciar sesión' },
  Dashboard: { es: 'Panel principal' },
  Lernmodus: {
    es: 'Modo aprendizaje',
    concept:
      'Activa los iconos `ⁱ` junto a los términos técnicos en alemán. Click para ver traducción ES + explicación. Desactivalo cuando los términos te resulten familiares.',
  },

  // ── Estados y campos genéricos ───────────────────────────────────────────
  Aktiv: { es: 'Activo' },
  Inaktiv: { es: 'Inactivo' },
  Gesamt: { es: 'Total' },
  Heute: { es: 'Hoy' },
  Neu: { es: 'Nuevo / Nueva' },
  Detail: { es: 'Detalle' },
  Status: { es: 'Estado' },
  Datum: { es: 'Fecha' },
  Uhrzeit: { es: 'Hora' },
  Name: { es: 'Nombre' },
  Adresse: { es: 'Dirección' },
  Straße: { es: 'Calle' },
  PLZ: { es: 'Código postal', concept: 'Postleitzahl — código postal alemán de 5 dígitos.' },
  'E-Mail': { es: 'Correo electrónico' },
  Telefon: { es: 'Teléfono' },
  Ansprechpartner: { es: 'Persona de contacto' },

  // ── Acciones ─────────────────────────────────────────────────────────────
  Speichern: { es: 'Guardar' },
  Bearbeiten: { es: 'Editar' },
  Löschen: { es: 'Borrar' },
  Deaktivieren: {
    es: 'Desactivar',
    concept:
      'Soft-delete: el registro no se borra de la base, queda inaktiv y se oculta de la lista por defecto. Su historia (ej. órdenes asociadas) se preserva.',
  },
  Reaktivieren: { es: 'Reactivar' },
  Suchen: { es: 'Buscar' },
  Filter: { es: 'Filtros' },
  Abbrechen: { es: 'Cancelar' },
  Weiter: { es: 'Siguiente' },
  Zurück: { es: 'Atrás' },
  Hochladen: { es: 'Subir archivo' },
  Herunterladen: { es: 'Descargar' },

  // ── Métricas / dashboards ────────────────────────────────────────────────
  Abgeschlossen: { es: 'Completado / Finalizado' },
  Offen: { es: 'Abierto / Pendiente' },
  Ausstehend: { es: 'Pendiente' },
}
