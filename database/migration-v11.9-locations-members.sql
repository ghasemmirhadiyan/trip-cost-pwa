-- v11.9: admin-only location creation/deletion; member removal is a soft delete (active=false)
DROP POLICY IF EXISTS locations_insert_member ON public.locations;
CREATE POLICY locations_insert_admin ON public.locations
FOR INSERT TO authenticated
WITH CHECK (public.is_trip_admin(trip_id) AND auth.uid()=created_by);

DROP POLICY IF EXISTS locations_delete_admin ON public.locations;
CREATE POLICY locations_delete_admin ON public.locations
FOR DELETE TO authenticated
USING (public.is_trip_admin(trip_id));

NOTIFY pgrst, 'reload schema';
