-- PYQ-LY · Storage for "My Library" — persist a user's uploaded paper/slide
-- files so a saved analysis can show the original PDFs later (not just in the
-- upload session). Run once in the Supabase SQL editor (Dashboard → SQL).
--
-- Private bucket; each user can only touch objects under their own uid/ prefix.
-- Files are stored at:  <auth.uid()>/<my_subject_id>/<key>-<filename>

insert into storage.buckets (id, name, public)
values ('subject-files', 'subject-files', false)
on conflict (id) do nothing;

-- A user reads/writes/deletes ONLY their own files (first path segment = uid).
create policy "subject-files: owner read"
  on storage.objects for select
  using (bucket_id = 'subject-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "subject-files: owner insert"
  on storage.objects for insert
  with check (bucket_id = 'subject-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "subject-files: owner update"
  on storage.objects for update
  using (bucket_id = 'subject-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "subject-files: owner delete"
  on storage.objects for delete
  using (bucket_id = 'subject-files' and (storage.foldername(name))[1] = auth.uid()::text);
