-- 周期服用功能：给 medications 表添加 cycle 相关字段
-- 在 Supabase SQL Editor 中执行

ALTER TABLE public.medications
  ADD COLUMN cycle_type text DEFAULT 'none'
    CHECK (cycle_type IN ('none', 'once', 'monthly', 'custom')),
  ADD COLUMN cycle_start_day integer,        -- 月循环开始日（1-31）
  ADD COLUMN cycle_end_day integer,          -- 月循环结束日（1-31）
  ADD COLUMN cycle_active_days integer,      -- 自定义循环：吃药天数
  ADD COLUMN cycle_rest_days integer,        -- 自定义循环：停药天数
  ADD COLUMN cycle_start_date date,          -- 疗程/循环起始日期
  ADD COLUMN cycle_end_date date;            -- 单次疗程结束日期（循环模式为 null）
