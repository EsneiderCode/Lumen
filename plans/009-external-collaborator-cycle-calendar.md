# Plan 009 — Calendario de ciclo del colaborador externo (hitos administrativos)

**Status:** IMPLEMENTED — 2026-06-13, decisiones D1–D7 confirmadas. Migración 029 + UI admin/contractor. PR #19 → EsneiderCode/Lumen:develop.
**Owner:** Jarl
**Target users:** Admin (define y publica) · Colaborador externo (ve su calendario)
**Created:** 2026-06-13
**Depends on:** ninguno técnico fuerte; convive con el flujo de billing/cert existente (migraciones `002_cert_audit`, `005_direct_orders_and_billing`, `006_collaborator_pricing`, `009_billing_flow_extensions`, `018_fix_billing_external_price_snapshot`).

---

## 1. Contexto y caso de uso

Los colaboradores externos necesitan visibilidad de las fechas administrativas de su
trabajo: cuándo se emiten sus trabajos válidos, la ventana de revisión, el OK de
certificación final y cuándo se paga la factura. Hoy esas fechas no existen como
entidad: el externo no sabe en qué punto del ciclo está ni cuándo cobra.

El **admin** define esas fechas-hito desde su panel y, cuando están listas, **valida/
publica** el ciclo. Solo a partir de la publicación el **colaborador externo** ve esos
días marcados en su calendario, cada uno con su convención (color/leyenda). Nunca antes.

### Unidad — CONFIRMADA: por ciclo del colaborador (Jarl, 2026-06-13)

Las fechas se atan a un **ciclo administrativo/de facturación del colaborador externo**
(p. ej. mensual), no a una orden puntual ni a un lote de órdenes.

- ~~Por orden de trabajo~~ — descartada.
- ~~Por lote de trabajos~~ — descartada.

---

## 2. Hitos del ciclo (las "convenciones")

Cuatro tipos de hito, cada uno con una convención visual distinta. Colores mapeados a
tokens semánticos NEXUS existentes (NO hex nuevos):

| Hito | Significado | Forma | Color (token) |
|------|-------------|-------|---------------|
| `emission`      | Emisión de trabajos válidos | 1 día | `--color-info` (#6BA6FF) |
| `review`        | Ventana de revisión | rango de 3 días | `--color-warn` (#FFB020) |
| `final_cert`    | OK de certificación final | 1 día | `--color-ok` (#4ADE80) |
| `payment`       | Pago de factura | 1 día | `--color-accent` (#FF4D2E) |

La leyenda (convenciones) se muestra junto al calendario en ambas vistas.

---

## 3. Reglas de negocio

1. **Pago (D4):** `payment_date = final_cert_date + 20 días`. El admin puede moverlo
   manualmente, **pero** cualquier cambio posterior de `final_cert_date` lo vuelve a
   fijar en `+20`, descartando el ajuste manual. Por eso NO hace falta flag de override.
2. **Ventana de revisión (D3):** el admin fija el día de inicio; el fin se deriva como
   **3 días hábiles** (excluye sábado/domingo y feriados — ver nota de feriados en §4).
3. **Gate de visibilidad:** el ciclo tiene estado `draft | published`. El externo solo
   ve ciclos `published`. La acción "Validar/Publicar" del admin hace `draft → published`
   y sella `published_at` / `published_by`.
4. **Despublicar (D5):** un ciclo `published` puede volver a `draft`; deja de verlo el
   externo hasta re-publicar. Las transiciones de estado van en ambos sentidos.
5. **Múltiples ciclos (D7):** un colaborador puede tener varios ciclos a la vez (incluso
   con períodos solapados). Sin constraint de unicidad por colaborador.

---

## 4. Modelo de datos (propuesto, sin aplicar)

Una tabla por ciclo, con columnas tipadas por hito (más simple que una tabla genérica de
eventos, porque los hitos son fijos y conocidos):

```sql
CREATE TABLE public.collaborator_cycles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id    uuid NOT NULL REFERENCES public.profiles(id),  -- rol contractor
  -- período de rango libre (D1): el admin fija inicio/fin
  period_start       date NOT NULL,
  period_end         date NOT NULL,
  period_label       text,                 -- opcional, etiqueta libre
  -- hitos
  emission_date      date,
  review_start_date  date,                 -- fin = +3 días HÁBILES (D3, derivado)
  final_cert_date    date,
  payment_date       date,                 -- = final_cert_date + 20 (D4, recalculado siempre)
  -- visibilidad
  status             text NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','published')),
  published_at       timestamptz,
  published_by       uuid REFERENCES public.profiles(id),
  -- auditoría
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE INDEX ON public.collaborator_cycles (collaborator_id, status);
```

- **Convenciones** = constante en frontend (`src/config/cycleMilestones.ts`): tipo → label
  i18n + token de color. No se persisten colores en DB.
- **`payment_date`** (D4): siempre `final_cert_date + 20`. El admin lo puede editar, pero
  cualquier cambio de `final_cert_date` lo re-fija a `+20`. Aplicar en la app y/o trigger.
- **Fin de revisión** (D3): se deriva de `review_start_date + 3 días hábiles`. **Nota de
  feriados:** los feriados en Alemania varían por Bundesland; v1 mínimo excluye fines de
  semana. Decidir al implementar si se incorpora un set de feriados (p. ej. NRW) o se deja
  solo fin de semana. No bloquea la spec.

### 4.1 Vínculo con órdenes (D2 — incluido en v1)

El ciclo lista explícitamente qué órdenes entran. Tabla puente:

```sql
CREATE TABLE public.collaborator_cycle_orders (
  cycle_id      uuid NOT NULL REFERENCES public.collaborator_cycles(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  PRIMARY KEY (cycle_id, work_order_id)
);
```

- El admin agrega/quita órdenes del ciclo desde su panel. La "emisión de trabajos válidos"
  refiere a las órdenes vinculadas al ciclo en `emission_date`.
- Confirmar el nombre real de la tabla de órdenes (`work_orders`) al implementar.

---

## 5. RLS / visibilidad

- **Admin:** SELECT/INSERT/UPDATE/DELETE sobre todos los ciclos.
- **Contractor:** SELECT solo de `collaborator_cycles` donde
  `collaborator_id = auth.uid()` **y** `status = 'published'`. Sin INSERT/UPDATE/DELETE.
- Seguir el patrón de RLS existente del repo (ver `013_lock_down_profile_self_updates`,
  `016_mvp_business_logic_hardening`).

---

## 6. UI — panel del admin

- Nueva vista (o sección en el detalle del colaborador externo) con un calendario donde
  el admin coloca los 4 hitos del ciclo y fija `period_start`/`period_end`.
- El admin **agrega/quita las órdenes** que entran en el ciclo (D2).
- Al fijar `final_cert_date`, el `payment_date` se autocompleta a `+20 días` (editable,
  pero todo cambio posterior de la certificación lo vuelve a `+20`, D4).
- Botón **"Validar / Publicar"** → `draft → published`. También puede **despublicar**
  (`published → draft`, D5). Mientras esté `draft`, el externo no ve nada.
- Leyenda de convenciones visible.
- Respetar NEXUS Brand System (tokens, sin sombras/gradientes/blur, íconos outline).

## 7. UI — calendario del colaborador externo

- Vista de calendario **solo lectura** que marca los días publicados con su convención
  (color/leyenda). La ventana de revisión se pinta como rango de 3 días.
- Si no hay ciclos publicados: estado vacío con texto (sin skeleton loaders).
- Punto de entrada: una ruta propia del contractor (hoy el contractor solo tiene la
  página de Documentos; ver `src/config/routes.ts`). Agregar ruta `/contractor/calendar`.

## 8. i18n

- Claves nuevas bajo `cycle.*`: labels de hitos (`cycle.milestone.emission|review|
  final_cert|payment`), título de vista, leyenda, acción "Publicar", estado vacío.
- Valores en alemán (`de.json`) y español neutro (`es.json`, usted, sin voseo).

## 9. Demo mode

- Extender `src/lib/demo/fixtures.ts`: 1 ciclo `published` para `contractor@demo.lumen`
  con los 4 hitos, y 1 ciclo `draft` (para verificar que NO lo ve el externo).
- Extender el mock de Supabase si hace falta una chain nueva (`src/lib/demo/supabase-mock.ts`).

## 10. Notas de migración

- Próximo número libre observado: **026** (el `025` es el más alto; confirmar con
  `git ls-tree origin/develop supabase/migrations/` al implementar, porque `025` está en
  la rama del NE4 sin mergear).
- Header con `Depends on:`. Solo se entrega el `.sql`; Alejandro aplica y regenera
  `database.types.ts`.
- Marcar el checkbox "Demo-mode coverage" en el PR.

---

## 11. Decisiones — RESUELTAS (Jarl, 2026-06-13)

- **D1 — Período:** Rango libre. El admin fija `period_start`/`period_end`; `period_label`
  opcional.
- **D2 — Vínculo con órdenes:** Incluido en v1. Tabla puente `collaborator_cycle_orders`
  (§4.1); el ciclo lista sus órdenes.
- **D3 — Revisión:** Inicio + **3 días hábiles** (excluye fin de semana; feriados a decidir
  al implementar).
- **D4 — Recálculo del pago:** Siempre `final_cert_date + 20`. Cualquier cambio de la
  certificación re-fija el pago; sin flag de override.
- **D5 — Despublicar:** Sí, `published → draft` permitido (deja de verlo el externo).
- **D6 — Notificaciones:** Fuera de v1 (sin aviso automático al publicar).
- **D7 — Múltiples ciclos:** Permitidos, incluso solapados. Sin unicidad por colaborador.

## 12. Fuera de alcance (v1)

- Notificación automática al externo al publicar (D6 — futuro, vía Telegram/OpenClaw).
- Edición del calendario por parte del externo (siempre solo lectura).
- Cálculo automático de montos de factura (eso vive en el flujo de billing existente).
- Calendario de feriados completo por Bundesland (v1 mínimo: excluir fin de semana).
- Sincronización con calendarios externos (Google/ICS).
