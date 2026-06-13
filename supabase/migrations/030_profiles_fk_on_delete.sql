-- 030: Set ON DELETE behavior for foreign keys referencing profiles
-- Depends on: 001_initial_schema
--
-- When a profile is deleted:
--   - work_orders.assigned_technician → SET NULL (order stays, technician cleared)
--   - work_orders.created_by → RESTRICT (cannot delete profile that created orders)
--   - work_order_photos.uploaded_by → SET NULL
--   - work_order_status_history.changed_by → SET NULL

-- assigned_technician: SET NULL
ALTER TABLE public.work_orders
  DROP CONSTRAINT work_orders_assigned_technician_fkey,
  ADD CONSTRAINT work_orders_assigned_technician_fkey
    FOREIGN KEY (assigned_technician) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- created_by: keep RESTRICT (should not delete a profile that owns orders)
-- No change needed — default is already RESTRICT/NO ACTION.

-- work_order_photos.uploaded_by: SET NULL
ALTER TABLE public.work_order_photos
  ALTER COLUMN uploaded_by DROP NOT NULL;

ALTER TABLE public.work_order_photos
  DROP CONSTRAINT work_order_photos_uploaded_by_fkey,
  ADD CONSTRAINT work_order_photos_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- work_order_state_history.changed_by: SET NULL
ALTER TABLE public.work_order_state_history
  ALTER COLUMN changed_by DROP NOT NULL;

ALTER TABLE public.work_order_state_history
  DROP CONSTRAINT work_order_state_history_changed_by_fkey,
  ADD CONSTRAINT work_order_state_history_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;
