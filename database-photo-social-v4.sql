-- Photo Social v4
-- Adds the profile visibility required to show uploader/commenter names to members of the same trip.
-- Keeps profiles private from users who share no trip.

DROP POLICY IF EXISTS profiles_select_trip_members ON public.profiles;

CREATE POLICY profiles_select_trip_members
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm_me
    JOIN public.trip_members tm_target
      ON tm_target.trip_id = tm_me.trip_id
    WHERE tm_me.user_id = auth.uid()
      AND tm_target.user_id = profiles.user_id
  )
);
