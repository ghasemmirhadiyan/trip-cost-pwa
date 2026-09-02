-- Photo Social v5: likes, comments, same-trip profile visibility, and Storage upload policy.
-- Safe to run after the original schema and previous photo-social migrations.

CREATE TABLE IF NOT EXISTS public.photo_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.album_photos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(photo_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.photo_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.album_photos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment text NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_likes_photo_id ON public.photo_likes(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_comments_photo_id ON public.photo_comments(photo_id);

ALTER TABLE public.photo_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS photo_likes_select_member ON public.photo_likes;
CREATE POLICY photo_likes_select_member ON public.photo_likes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.album_photos ap WHERE ap.id=photo_likes.photo_id AND public.is_trip_member(ap.trip_id)));
DROP POLICY IF EXISTS photo_likes_insert_self ON public.photo_likes;
CREATE POLICY photo_likes_insert_self ON public.photo_likes FOR INSERT TO authenticated
WITH CHECK (auth.uid()=user_id AND EXISTS (SELECT 1 FROM public.album_photos ap WHERE ap.id=photo_likes.photo_id AND public.is_trip_member(ap.trip_id)));
DROP POLICY IF EXISTS photo_likes_delete_self ON public.photo_likes;
CREATE POLICY photo_likes_delete_self ON public.photo_likes FOR DELETE TO authenticated
USING (auth.uid()=user_id);

DROP POLICY IF EXISTS photo_comments_select_member ON public.photo_comments;
CREATE POLICY photo_comments_select_member ON public.photo_comments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.album_photos ap WHERE ap.id=photo_comments.photo_id AND public.is_trip_member(ap.trip_id)));
DROP POLICY IF EXISTS photo_comments_insert_self ON public.photo_comments;
CREATE POLICY photo_comments_insert_self ON public.photo_comments FOR INSERT TO authenticated
WITH CHECK (auth.uid()=user_id AND EXISTS (SELECT 1 FROM public.album_photos ap WHERE ap.id=photo_comments.photo_id AND public.is_trip_member(ap.trip_id)));
DROP POLICY IF EXISTS photo_comments_update_self ON public.photo_comments;
CREATE POLICY photo_comments_update_self ON public.photo_comments FOR UPDATE TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
DROP POLICY IF EXISTS photo_comments_delete_self ON public.photo_comments;
CREATE POLICY photo_comments_delete_self ON public.photo_comments FOR DELETE TO authenticated USING (auth.uid()=user_id);

DROP POLICY IF EXISTS profiles_select_trip_members ON public.profiles;
CREATE POLICY profiles_select_trip_members ON public.profiles FOR SELECT TO authenticated
USING (EXISTS (
 SELECT 1 FROM public.trip_members tm_me
 JOIN public.trip_members tm_target ON tm_target.trip_id=tm_me.trip_id
 WHERE tm_me.user_id=auth.uid() AND tm_target.user_id=profiles.user_id
));

-- Requires a public Storage bucket named trip-photos. Members may upload only under their trip UUID folder.
DROP POLICY IF EXISTS trip_photos_member_upload ON storage.objects;
CREATE POLICY trip_photos_member_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
 bucket_id='trip-photos' AND
 public.is_trip_member((storage.foldername(name))[1]::uuid)
);
