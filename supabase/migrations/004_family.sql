-- ===== 家庭共享功能 =====

-- 家庭组
CREATE TABLE IF NOT EXISTS families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text UNIQUE NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- 家庭成员
CREATE TABLE IF NOT EXISTS family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'member',  -- 'owner' | 'member' | 'viewer'
  nickname text,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(family_id, user_id)
);

-- ===== RLS 策略 =====

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

-- families: 家庭成员可查看自己所在的家庭
CREATE POLICY "Users can view their families"
ON families FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM family_members
    WHERE family_members.family_id = families.id
    AND family_members.user_id = auth.uid()
  )
);

-- families: 任何登录用户可以创建家庭
CREATE POLICY "Users can create families"
ON families FOR INSERT WITH CHECK (
  auth.uid() = created_by
);

-- families: 只有创建者可以修改家庭
CREATE POLICY "Family owner can update"
ON families FOR UPDATE USING (
  auth.uid() = created_by
);

-- families: 只有创建者可以删除家庭
CREATE POLICY "Family owner can delete"
ON families FOR DELETE USING (
  auth.uid() = created_by
);

-- families: 允许任何登录用户通过邀请码查询家庭（用于加入）
CREATE POLICY "Users can lookup family by invite code"
ON families FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- family_members: 家庭成员可查看同一家庭的成员列表
CREATE POLICY "Family members can view each other"
ON family_members FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM family_members AS fm
    WHERE fm.family_id = family_members.family_id
    AND fm.user_id = auth.uid()
  )
);

-- family_members: 登录用户可以加入家庭（INSERT 自己）
CREATE POLICY "Users can join families"
ON family_members FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

-- family_members: 用户可以更新自己的成员信息（昵称等）
CREATE POLICY "Users can update own membership"
ON family_members FOR UPDATE USING (
  auth.uid() = user_id
);

-- family_members: 用户可以离开家庭 / owner 可以移除成员
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

-- ===== 扩展现有表的 RLS: 允许家庭成员查看数据 =====

-- medication_logs: 家庭成员可查看
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

-- medications: 家庭成员可查看
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

-- schedules: 家庭成员可查看
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

-- health_records: 家庭成员可查看
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

-- medication_logs: 家庭 member 角色可以帮忙标记吃药
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

-- ===== 索引 =====
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_families_invite_code ON families(invite_code);
