-- Migration 012 — Material inventory by vehicle + Rückmeldung consumption
-- Depends on: 011_contractor_documents.sql
--
-- Adds client-scoped material catalog data, vehicles assigned to exactly one
-- team, vehicle stock balances, stock movement audit, and material consumption
-- rows linked to work orders.

ALTER TABLE public.materials
  DROP CONSTRAINT IF EXISTS materials_unit_check;

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Sonstiges',
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS catalog_client_id UUID REFERENCES public.clients(id),
  ADD COLUMN IF NOT EXISTS catalog_source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_materials_catalog_client
  ON public.materials (catalog_client_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_materials_catalog_sku_unique
  ON public.materials (catalog_client_id, catalog_source, lower(sku))
  WHERE sku IS NOT NULL AND sku <> '';

DROP TRIGGER IF EXISTS set_materials_updated_at ON public.materials;
CREATE TRIGGER set_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.inventory_vehicles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  team          public.team_color NOT NULL,
  license_plate TEXT,
  notes         TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inventory_vehicles_name_not_blank CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_vehicles_name_unique
  ON public.inventory_vehicles (lower(name));

CREATE INDEX IF NOT EXISTS idx_inventory_vehicles_team
  ON public.inventory_vehicles (team)
  WHERE active = true;

DROP TRIGGER IF EXISTS set_inventory_vehicles_updated_at ON public.inventory_vehicles;
CREATE TRIGGER set_inventory_vehicles_updated_at
  BEFORE UPDATE ON public.inventory_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.vehicle_material_stock (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID NOT NULL REFERENCES public.inventory_vehicles(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  quantity    NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_material_stock_vehicle
  ON public.vehicle_material_stock (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_material_stock_material
  ON public.vehicle_material_stock (material_id);

DROP TRIGGER IF EXISTS set_vehicle_material_stock_updated_at ON public.vehicle_material_stock;
CREATE TRIGGER set_vehicle_material_stock_updated_at
  BEFORE UPDATE ON public.vehicle_material_stock
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.work_order_material_consumptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id     UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  vehicle_id        UUID NOT NULL REFERENCES public.inventory_vehicles(id),
  material_id       UUID NOT NULL REFERENCES public.materials(id),
  quantity          NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  reported_by       UUID NOT NULL REFERENCES public.profiles(id),
  stock_real_before NUMERIC(12,2),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_womc_work_order
  ON public.work_order_material_consumptions (work_order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_womc_vehicle
  ON public.work_order_material_consumptions (vehicle_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id     UUID NOT NULL REFERENCES public.inventory_vehicles(id),
  material_id    UUID NOT NULL REFERENCES public.materials(id),
  work_order_id  UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  movement_type  TEXT NOT NULL CHECK (movement_type IN ('import', 'admin_adjustment', 'tech_correction', 'consumption')),
  quantity_delta NUMERIC(12,2) NOT NULL,
  stock_before   NUMERIC(12,2) NOT NULL,
  stock_after    NUMERIC(12,2) NOT NULL,
  reason         TEXT,
  created_by     UUID NOT NULL REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_vehicle_created
  ON public.stock_movements (vehicle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_material_created
  ON public.stock_movements (material_id, created_at DESC);

ALTER TABLE public.inventory_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_material_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_material_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_vehicles_admin_all" ON public.inventory_vehicles;
CREATE POLICY "inventory_vehicles_admin_all"
  ON public.inventory_vehicles FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "inventory_vehicles_team_select" ON public.inventory_vehicles;
CREATE POLICY "inventory_vehicles_team_select"
  ON public.inventory_vehicles FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.team = inventory_vehicles.team
    )
  );

DROP POLICY IF EXISTS "vehicle_stock_admin_all" ON public.vehicle_material_stock;
CREATE POLICY "vehicle_stock_admin_all"
  ON public.vehicle_material_stock FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "vehicle_stock_team_select" ON public.vehicle_material_stock;
CREATE POLICY "vehicle_stock_team_select"
  ON public.vehicle_material_stock FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.inventory_vehicles v
      JOIN public.profiles p ON p.team = v.team
      WHERE v.id = vehicle_material_stock.vehicle_id
        AND p.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vehicle_stock_team_write" ON public.vehicle_material_stock;
CREATE POLICY "vehicle_stock_team_write"
  ON public.vehicle_material_stock FOR ALL TO authenticated
  USING (
    public.get_user_role() IN ('technician', 'contractor')
    AND EXISTS (
      SELECT 1
      FROM public.inventory_vehicles v
      JOIN public.profiles p ON p.team = v.team
      WHERE v.id = vehicle_material_stock.vehicle_id
        AND p.id = auth.uid()
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('technician', 'contractor')
    AND EXISTS (
      SELECT 1
      FROM public.inventory_vehicles v
      JOIN public.profiles p ON p.team = v.team
      WHERE v.id = vehicle_material_stock.vehicle_id
        AND p.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "womc_admin_all" ON public.work_order_material_consumptions;
CREATE POLICY "womc_admin_all"
  ON public.work_order_material_consumptions FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "womc_assignee_select" ON public.work_order_material_consumptions;
CREATE POLICY "womc_assignee_select"
  ON public.work_order_material_consumptions FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_material_consumptions.work_order_id
        AND wo.assigned_technician = auth.uid()
    )
  );

DROP POLICY IF EXISTS "womc_assignee_insert" ON public.work_order_material_consumptions;
CREATE POLICY "womc_assignee_insert"
  ON public.work_order_material_consumptions FOR INSERT TO authenticated
  WITH CHECK (
    reported_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_material_consumptions.work_order_id
        AND wo.assigned_technician = auth.uid()
    )
  );

DROP POLICY IF EXISTS "stock_movements_admin_all" ON public.stock_movements;
CREATE POLICY "stock_movements_admin_all"
  ON public.stock_movements FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "stock_movements_team_select" ON public.stock_movements;
CREATE POLICY "stock_movements_team_select"
  ON public.stock_movements FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.inventory_vehicles v
      JOIN public.profiles p ON p.team = v.team
      WHERE v.id = stock_movements.vehicle_id
        AND p.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "stock_movements_team_insert" ON public.stock_movements;
CREATE POLICY "stock_movements_team_insert"
  ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.get_user_role() IN ('technician', 'contractor')
    AND EXISTS (
      SELECT 1
      FROM public.inventory_vehicles v
      JOIN public.profiles p ON p.team = v.team
      WHERE v.id = stock_movements.vehicle_id
        AND p.id = auth.uid()
    )
  );
