-- ============================================
-- 小猫吃药监督 - 完整数据库迁移脚本
-- 在新 Supabase 项目的 SQL Editor 中一次性执行
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- 1. MEDICATIONS: 药柜
-- ===========================================
CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dosage text,
  unit text DEFAULT '粒',
  frequency text DEFAULT 'daily'
    CHECK (frequency IN ('daily', 'twice_daily', 'three_daily', 'weekly', 'as_needed')),
  photo_url text,
  barcode text,
  expiry_date date,
  notes text,
  color text DEFAULT '#FF9F43',
  is_active boolean DEFAULT true,
  -- migration 001: cycle fields
  cycle_type text DEFAULT 'none'
    CHECK (cycle_type IN ('none', 'once', 'monthly', 'custom')),
  cycle_start_day integer,
  cycle_end_day integer,
  cycle_active_days integer,
  cycle_rest_days integer,
  cycle_start_date date,
  cycle_end_date date,
  -- migration 003: illness & usage
  illness text DEFAULT NULL,
  usage_note text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN medications.illness IS '治疗病症，如 感冒、高血压';
COMMENT ON COLUMN medications.usage_note IS '服用方式，如 饭后服用、空腹服用';

-- ===========================================
-- 2. SCHEDULES: 提醒计划
-- ===========================================
CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_of_day time NOT NULL,
  days_of_week integer[] DEFAULT '{0,1,2,3,4,5,6}',
  enabled boolean DEFAULT true,
  notification_id text,
  created_at timestamptz DEFAULT now()
);

-- ===========================================
-- 3. MEDICATION_LOGS: 用药记录
-- ===========================================
CREATE TABLE public.medication_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'taken', 'skipped', 'missed')),
  taken_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Unique: one log per schedule per day
CREATE UNIQUE INDEX idx_logs_unique
  ON public.medication_logs(schedule_id, scheduled_date)
  WHERE schedule_id IS NOT NULL;

-- ===========================================
-- 4. HEALTH_RECORDS: 健康数据（血糖/血压/体重）
-- ===========================================
CREATE TABLE public.health_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('blood_sugar', 'blood_pressure', 'weight')),
  value1 numeric NOT NULL,
  value2 numeric,
  unit text NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

-- ===========================================
-- 5. FAMILIES: 家庭共享
-- ===========================================
CREATE TABLE IF NOT EXISTS families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text UNIQUE NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'member',
  nickname text,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(family_id, user_id)
);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX idx_medications_user ON public.medications(user_id);
CREATE INDEX idx_schedules_medication ON public.schedules(medication_id);
CREATE INDEX idx_schedules_user ON public.schedules(user_id);
CREATE INDEX idx_logs_user_date ON public.medication_logs(user_id, scheduled_date);
CREATE INDEX idx_logs_medication ON public.medication_logs(medication_id);
CREATE INDEX idx_health_user_type ON public.health_records(user_id, type, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_families_invite_code ON families(invite_code);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

-- medications
CREATE POLICY "Users manage own medications"
  ON public.medications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- schedules
CREATE POLICY "Users manage own schedules"
  ON public.schedules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- medication_logs
CREATE POLICY "Users manage own logs"
  ON public.medication_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- health_records
CREATE POLICY "Users manage own health records"
  ON public.health_records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- families
CREATE POLICY "Users can view their families"
  ON families FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM family_members
      WHERE family_members.family_id = families.id
      AND family_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create families"
  ON families FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Family owner can update"
  ON families FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Family owner can delete"
  ON families FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Users can lookup family by invite code"
  ON families FOR SELECT USING (auth.uid() IS NOT NULL);

-- family_members
CREATE POLICY "Family members can view each other"
  ON family_members FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM family_members AS fm
      WHERE fm.family_id = family_members.family_id
      AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join families"
  ON family_members FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own membership"
  ON family_members FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can leave or owner can remove"
  ON family_members FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM family_members AS fm
      JOIN families ON families.id = fm.family_id
      WHERE fm.family_id = family_members.family_id
      AND families.created_by = auth.uid()
    )
  );

-- family cross-table view policies
CREATE POLICY "Family members can view medication logs"
  ON medication_logs FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM family_members fm1
      JOIN family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE fm1.user_id = auth.uid()
      AND fm2.user_id = medication_logs.user_id
      AND fm1.user_id != fm2.user_id
    )
  );

CREATE POLICY "Family members can view medications"
  ON medications FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM family_members fm1
      JOIN family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE fm1.user_id = auth.uid()
      AND fm2.user_id = medications.user_id
      AND fm1.user_id != fm2.user_id
    )
  );

CREATE POLICY "Family members can view schedules"
  ON schedules FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM family_members fm1
      JOIN family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE fm1.user_id = auth.uid()
      AND fm2.user_id = schedules.user_id
      AND fm1.user_id != fm2.user_id
    )
  );

CREATE POLICY "Family members can view health records"
  ON health_records FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM family_members fm1
      JOIN family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE fm1.user_id = auth.uid()
      AND fm2.user_id = health_records.user_id
      AND fm1.user_id != fm2.user_id
    )
  );

CREATE POLICY "Family members can update medication logs"
  ON medication_logs FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM family_members fm1
      JOIN family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE fm1.user_id = auth.uid()
      AND fm2.user_id = medication_logs.user_id
      AND fm1.role IN ('owner', 'member')
    )
  );

-- ===========================================
-- STORAGE: 药品照片
-- ===========================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('medication-photos', 'medication-photos', false);

CREATE POLICY "Users upload own photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'medication-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read own photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'medication-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
