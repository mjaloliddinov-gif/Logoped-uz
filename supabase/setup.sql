-- Run once in Supabase SQL Editor as the project database administrator.
BEGIN;
CREATE SCHEMA IF NOT EXISTS logoped;
REVOKE ALL ON SCHEMA logoped FROM PUBLIC;
SET LOCAL search_path=logoped,public;
CREATE TABLE IF NOT EXISTS members(id text PRIMARY KEY,email text NOT NULL,role text NOT NULL CHECK(role IN ('admin','logoped','parent','student','pending')));
CREATE TABLE IF NOT EXISTS settings(id text PRIMARY KEY,value text NOT NULL);
CREATE TABLE IF NOT EXISTS records(id text PRIMARY KEY,kind text NOT NULL,owner text NOT NULL,student text,data text NOT NULL,created text NOT NULL);
CREATE INDEX IF NOT EXISTS records_student ON records(student);
CREATE INDEX IF NOT EXISTS records_kind ON records(kind);
CREATE INDEX IF NOT EXISTS records_owner ON records(owner);
CREATE TABLE IF NOT EXISTS audit(id text PRIMARY KEY,actor text NOT NULL,action text NOT NULL,target text NOT NULL,created text NOT NULL);
CREATE TABLE IF NOT EXISTS notifications(id text PRIMARY KEY,owner text NOT NULL,title text NOT NULL,created text NOT NULL,seen text NOT NULL DEFAULT '0');
CREATE INDEX IF NOT EXISTS notifications_owner ON notifications(owner);
CREATE TABLE IF NOT EXISTS invites(id text PRIMARY KEY,token_hash text NOT NULL,email text NOT NULL,student text NOT NULL,role text NOT NULL,owner text NOT NULL,created text NOT NULL,expires text NOT NULL,status text NOT NULL,accepted_by text);
CREATE INDEX IF NOT EXISTS invites_token ON invites(token_hash);
CREATE TABLE IF NOT EXISTS ai_requests(id text PRIMARY KEY,owner text NOT NULL,created bigint NOT NULL);
CREATE INDEX IF NOT EXISTS ai_requests_owner_created ON ai_requests(owner,created);
CREATE TABLE IF NOT EXISTS admin_attempts(owner text PRIMARY KEY,"window" bigint NOT NULL,attempts integer NOT NULL);
CREATE TABLE IF NOT EXISTS admin_grants(token_hash text PRIMARY KEY,owner text NOT NULL,version text NOT NULL,expires bigint NOT NULL);
CREATE INDEX IF NOT EXISTS admin_grants_owner ON admin_grants(owner);
CREATE OR REPLACE FUNCTION logoped.json_extract(document text,path text) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT document::jsonb #>> string_to_array(substr(path,3),'.') $$;
CREATE OR REPLACE FUNCTION logoped.json_set(document text,path text,new_value text) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT jsonb_set(document::jsonb,string_to_array(substr(path,3),'.'),to_jsonb(new_value),true)::text $$;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA logoped FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA logoped FROM PUBLIC;
-- Supabase browser roles have no database access. Application server enforces per-child scope.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON SCHEMA logoped FROM anon,authenticated;
  REVOKE ALL ON ALL TABLES IN SCHEMA logoped FROM anon,authenticated;
 END IF;
END $$;
COMMIT;
-- In Supabase Storage UI create a PRIVATE bucket named logoped-private (4 MiB limit).
-- Do NOT add public read/write policies. Only the server's secret key accesses this bucket.
