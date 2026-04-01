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

### 2026-04-01: ⚠️ Axios NPM 供应链污染安全检查
- **内容**：axios 在 npm 上被投放恶意版本，携带 RAT
- **行动**：(1) 检查 package.json 中 axios 版本；(2) 运行 `npm audit`；(3) 与 RLS 安全审查合并做，上线前必须完成
- **优先级**：高
