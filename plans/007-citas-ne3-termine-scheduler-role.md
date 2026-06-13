# Plan 007 — Perfil "Citas NE3 (DGF)" / Termine scheduler role

**Status:** IMPLEMENTED — 2026-06-13, decision (A) Gestora. Migrations 027/028 + scheduler UI/role. PR #19 → EsneiderCode/Lumen:develop.
**Owner:** Jarl
**Target user:** Beatriz Sandoval — `bsandoval@umtelkomd.com`
**Created:** 2026-06-13

---

## 1. Context & use case

Beatriz necesita un perfil **restringido** en LUMEN cuyo único trabajo sea gestionar
**citas / Termine de la línea NE3 para el operador DGF**. No debe ver ni tocar el resto
de la operación (otras líneas, otros operadores, certificación, personal, materiales).

- **NE3** = línea (ya existe en el modelo: `'NE3' | 'NE4'`).
- **DGF** = operador (ya existe el concepto operador: DGF, GFP, UGG).
- **Cita / Termin** = **NO existe** hoy en el código. Las órdenes tienen *estados*,
  no *citas con fecha/hora agendadas*. Hay que crear la entidad.

### Decisión CENTRAL — RESUELTA: (A) Gestora (confirmada por Jarl, 2026-06-13)

Beatriz **agenda/crea** las citas (no solo recibe/confirma).

- **(A) Gestora — CONFIRMADO:** Beatriz crea, agenda, confirma, reagenda y cierra las
  citas NE3 del operador DGF. Modelo y manual están escritos asumiendo esto.
- ~~(B) Receptora: solo ve y confirma/rechaza citas creadas por otro sistema.~~ Descartada.

---

## 2. Modelo de datos (propuesto, sin aplicar)

### 2.1 Nuevo valor de enum `user_role`

```
admin | technician | contractor | scheduler   <-- nuevo
```

- Identificador en inglés: `scheduler` (regla del repo: artefactos en inglés).
- Etiqueta i18n: ES "Coordinación de citas" · DE "Terminplanung".

**Gotcha Postgres:** `ALTER TYPE ... ADD VALUE` no puede usarse en la misma
transacción donde luego se referencia el nuevo valor. Hay que separarlo: la migración
que agrega el valor del enum va **sola**, y el resto (tabla, RLS que referencian
`'scheduler'`) en una migración posterior. Declarar `Depends on:` en el header.

### 2.2 Scope del scheduler en `profiles`

Para atar a Beatriz a NE3 + DGF (no hardcodear):

```sql
ALTER TABLE public.profiles
  ADD COLUMN scheduler_line     text   CHECK (scheduler_line IN ('NE3','NE4')),
  ADD COLUMN scheduler_operator uuid   REFERENCES public.operators(id);
```

Beatriz: `role='scheduler'`, `scheduler_line='NE3'`, `scheduler_operator=<DGF>`.

### 2.3 Nueva tabla `appointments` (Termine)

```sql
CREATE TABLE public.appointments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL, -- opcional
  line          text NOT NULL CHECK (line IN ('NE3','NE4')),
  operator_id   uuid NOT NULL REFERENCES public.operators(id),
  scheduled_at  timestamptz NOT NULL,
  duration_min  int  NOT NULL DEFAULT 60,
  address       text,
  contact_name  text,
  contact_phone text,
  status        text NOT NULL DEFAULT 'proposed'
                CHECK (status IN ('proposed','confirmed','rescheduled','completed','cancelled')),
  notes         text,
  assigned_to   uuid REFERENCES public.profiles(id),  -- el scheduler responsable
  created_by    uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appointments_line_operator_idx ON public.appointments(line, operator_id, scheduled_at);
```

Link a `work_orders` es **opcional**: una cita puede existir antes de tener orden, o
referenciar una orden NE3 existente.

### 2.4 RLS

```sql
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- admin: todo
CREATE POLICY appointments_admin_all ON public.appointments
  FOR ALL USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- scheduler: solo su línea + su operador (scope desde profiles)
CREATE POLICY appointments_scheduler_scope ON public.appointments
  FOR ALL
  USING (
    public.get_user_role() = 'scheduler'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.scheduler_line = appointments.line
        AND p.scheduler_operator = appointments.operator_id
    )
  )
  WITH CHECK ( /* idéntico al USING */ );
```

Resultado: Beatriz solo ve/edita citas `line='NE3' AND operator_id=DGF`. Cero acceso al
resto del schema (las demás tablas ya tienen RLS admin/owner; `scheduler` no matchea
ninguna otra policy → sin acceso).

---

## 3. UI (propuesto)

- **Nuevo layout** `SchedulerLayout` (espejo de `ContractorLayout`/`TechnicianLayout`):
  menú lateral mínimo → solo "Citas / Termine".
- **Rutas** bajo `ROUTES.SCHEDULER`:
  - `/scheduler/appointments` — lista filtrada NE3 + DGF (por su scope), con estados.
  - `/scheduler/appointments/:id` — detalle: reagendar, confirmar, completar, cancelar.
  - `/scheduler/appointments/new` — crear (solo si caso (A)).
- **Auth gating** por `role==='scheduler'` en el router (igual que los otros roles).
- Diseño 100% NEXUS Brand System (tokens, sin hex hardcodeado, outline icons, etc.).

---

## 4. Demo mode (obligatorio por convención del repo)

- Agregar a `src/lib/demo/fixtures.ts`: usuario `scheduler` (Beatriz, NE3/DGF) +
  3–4 appointments de ejemplo en distintos estados.
- Extender `src/lib/demo/supabase-mock.ts`: tabla `appointments` + filtros line/operator.
- Login demo: `beatriz@demo.lumen` / `demo123`.

## 5. i18n

- `nav.appointments`, sección `appointments.*` (estados, campos, acciones) en
  `de.json` y `es.json`. Término de dominio: **Termin/Termine** se queda en alemán.

## 6. Migraciones (numeración)

- Antes de elegir número: `git ls-tree origin/develop supabase/migrations/` (regla dura).
- Hoy local llega a `025`. Tentativo:
  - `026_user_role_scheduler.sql` — solo `ALTER TYPE user_role ADD VALUE 'scheduler'`.
  - `027_appointments_and_scheduler_scope.sql` — `profiles` cols + tabla + RLS.
    `Depends on: 026`.
- Alejandro aplica; regenerar `database.types.ts` después.

## 7. Fuera de alcance (este plan)

- Notificaciones Telegram de citas (se puede sumar después vía OpenClaw webhook).
- Sincronización con calendarios externos (Google/Outlook).
- Que el scheduler vea NE4 u otros operadores.

## 8. Checklist de implementación (cuando des OK)

1. [ ] Confirmar decisión (A) vs (B).
2. [ ] Verificar numeración de migración contra `origin/develop`.
3. [ ] Migración enum `scheduler` (sola).
4. [ ] Migración `profiles` scope + tabla `appointments` + RLS.
5. [ ] Regenerar tipos.
6. [ ] Layout + rutas + páginas scheduler (lista/detalle/crear).
7. [ ] Demo: fixtures + mock + usuario Beatriz.
8. [ ] i18n de/es.
9. [ ] Tests de servicio (filtros line/operator, transiciones de estado).
10. [ ] Manual del perfil (ya en borrador, ver `scripts/generate-manuals.mjs`).
11. [ ] `npm run pre-pr` y PR a `develop`.

---

### Notas
- Branch sugerido: `feat/scheduler-citas-ne3` (rama limpia, NO sobre la del PR #18).
- El manual del perfil ya está como borrador en el generador (`manual-citas-ne3-es.pdf`),
  escrito sobre el supuesto (A). Si confirmás (B), se ajusta en minutos.
