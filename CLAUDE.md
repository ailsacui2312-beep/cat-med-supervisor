# Cat Med Supervisor 小猫吃药监督 — 项目指引

## 项目概述

猫咪用药管理 App — React Native (Expo SDK 54) + Supabase + TypeScript + expo-router

**当前状态：家庭共享 Phase 1 进行中（前端待做）**

---

## 开发环境

```bash
cd mobile && npx expo start
```

---

## 关键原则

- 家庭共享上线前 ALWAYS 做 RLS 安全测试，不能跳过
- NEVER 假设 AI 生成的 RLS 一定安全，必须用真实账号测试越权访问
- 长辈模式改动后 ALWAYS 在大字体设备上验证

---

## 当前进度

- ✅ 猫咪视频集成
- ✅ 身体数据改进
- ✅ 我的页面完善
- ✅ 长辈模式适配
- ✅ DB SQL（家庭共享）
- ✅ RLS 递归 bug 修复
- 🔄 家庭共享前端（进行中）
- ⏳ Android APK 打包
- ⏳ 猫咪视频背景处理

---

## 待办（按优先级）

### 高优先级
- [ ] **家庭共享前端** — DB 已就绪，前端待实现
- [ ] **RLS 安全测试** — 前端完成后，用普通账号尝试越权访问其他家庭的猫咪数据，确认所有 CRUD 都有 RLS 覆盖
- [ ] **Axios NPM 安全检查** — 检查 axios 版本 + `npm audit`，与 RLS 审查合并做

### 中优先级
- [ ] **Android APK 打包**
- [ ] **Lottie 替代视频背景** — 解决颜色适配问题，体积更小，透明背景

### 低优先级
- [ ] **Expo SDK 55 升级** — 家庭共享完成后再评估，重点看长辈模式启动速度

---

## 指挥官派发

> 以下任务由指挥官根据技术扫描自动写入，启动时评估并处理。

### 2026-09-26: 🔴 Supabase 客户项目大面积数据裸露（配置问题，不是平台漏洞）
- **内容**：TechCrunch 9/25 援引 UpGuard 研究——约 **16,000 个 Supabase 数据库**因基础配置不当，把姓名、地址、电话、部分密码/认证 token 直接暴露在公网。Supabase CISO 的回应是「平台提供安全默认值，项目怎么配由客户自己负责」——**责任在项目方**。
- **行动**：(1) 在 Supabase Dashboard → Advisors → **Security Advisor** 跑一次，清零所有 "RLS disabled" / "policy exists but RLS disabled" 告警；(2) 逐表确认 CatMed 家庭共享数据（宠物、用药记录、家庭成员） 所在的每张表都 `ENABLE ROW LEVEL SECURITY` 且 policy 按 `auth.uid()` 限定；(3) 用**只带 anon key、不登录**的请求直接查各表，确认返回空（这是 UpGuard 的检测方式）；(4) 确认 `service_role` key 没有出现在 App 包、仓库或前端代码里；(5) Storage bucket 逐个确认不是 public。
- **优先级**：🔴 极高 — 来源: tech-brain 2026-09-26（TechCrunch 9/25 / UpGuard）

### 2026-06-13: 🔴 Supabase 认证绕过漏洞 CVE-2026-31813
- **内容**：Supabase Auth 存在认证绕过漏洞——启用 Apple/Azure 登录时，对 OIDC ID token 校验不当，攻击者可伪造 ID token 为任意用户签发 session（直接接管账号）。**2.185.0 之前的版本受影响。**
- **行动**：(1) 核实当前 Supabase（GoTrue/Auth）版本；(2) 升级到 ≥ 2.185.0；(3) CatMed 用 Apple 登录——属于受影响 provider，**与家庭共享 RLS 安全审查合并做，上线前必须完成**。
- **优先级**：🔴 极高 — 来源: tech-brain 2026-06-13（CVE-2026-31813）

### 2026-04-01: ⚠️ Axios NPM 供应链污染安全检查
- **内容**：axios 在 npm 上被投放恶意版本，携带 RAT
- **行动**：(1) 检查 package.json 中 axios 版本；(2) 运行 `npm audit`；(3) 与 RLS 安全审查合并做，上线前必须完成
- **优先级**：高
