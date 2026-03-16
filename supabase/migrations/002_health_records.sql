-- 健康数据记录表（血糖/血压/体重）
-- 在 Supabase SQL Editor 中执行

CREATE TABLE public.health_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('blood_sugar', 'blood_pressure', 'weight')),
  value1 numeric NOT NULL,       -- 血糖值 / 收缩压 / 体重
  value2 numeric,                -- 舒张压（仅血压用）
  unit text NOT NULL,            -- mmol/L, mg/dL, mmHg, kg, lb
  measured_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  source text DEFAULT 'manual',  -- manual / screenshot
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_health_user_type ON public.health_records(user_id, type, measured_at DESC);

ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own health records"
  ON public.health_records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
