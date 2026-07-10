-- Adds an `attachments` column to tasks, goals, and department_plans so
-- these entities can store uploaded file metadata the same way `reports`
-- already does (JSON-stringified array of { name, size, type, url,
-- publicId, format, originalName } objects, produced by uploadFiles() in
-- services/uploadService.js).
--
-- Run this once in the Supabase SQL editor.

alter table tasks add column if not exists attachments text;
alter table goals add column if not exists attachments text;
alter table department_plans add column if not exists attachments text;
