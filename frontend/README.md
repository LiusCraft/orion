# Orion Frontend

智能运维主动保障平台前端界面

## 功能特性

- 🛡️ **总览仪表盘**: 实时监控系统状态和关键指标
- 📋 **保障任务管理**: 创建、查看和管理运维保障任务  
- 📊 **监控观察**: 实时指标监控和基线比对
- 🔔 **告警中心**: 多通道通知和告警管理
- ⚡ **操作中心**: 一键式应急操作和审批流程
- 📱 **响应式设计**: 支持桌面和移动端访问

## 技术栈

- **前端框架**: React 18 + TypeScript
- **UI组件库**: Ant Design 5.x
- **图表库**: Recharts
- **构建工具**: Vite
- **包管理**: npm

## 快速开始

### 安装依赖
```bash
cd frontend
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 代码检查
```bash
npm run lint
```

## 项目结构

```
frontend/
├── src/
│   ├── components/     # 公共组件
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── NotificationCenter.tsx
│   │   └── ActionCenter.tsx
│   ├── pages/         # 页面组件
│   │   ├── Dashboard.tsx
│   │   ├── TaskManagement.tsx
│   │   └── MonitoringDashboard.tsx
│   ├── types/         # TypeScript 类型定义
│   │   └── index.ts
│   ├── App.tsx        # 主应用组件
│   ├── main.tsx       # 应用入口
│   └── index.css      # 全局样式
├── public/            # 静态资源
├── index.html         # HTML 模板
├── package.json       # 项目配置
├── vite.config.ts     # Vite 配置
└── tsconfig.json      # TypeScript 配置
```

## 核心功能

### 1. 仪表盘 (Dashboard)
- 实时统计卡片展示
- 当前任务列表
- 紧急告警显示
- 系统状态监控

### 2. 任务管理 (TaskManagement) 
- 保障任务创建和编辑
- 任务状态跟踪
- 历史任务查询
- 任务模板管理

### 3. 监控观察 (MonitoringDashboard)
- 实时指标图表
- 基线比对分析
- 异常检测告警
- 趋势分析展示

### 4. 通知中心 (NotificationCenter)
- 多通道通知管理
- 通知规则配置
- 紧急联系人设置
- 免打扰时段配置

### 5. 操作中心 (ActionCenter)
- 一键式操作审批
- 操作执行跟踪
- 操作历史记录
- 操作统计报表

## 开发规范

- 使用 TypeScript 进行类型安全开发
- 遵循 Ant Design 设计规范
- 组件采用函数式组件 + Hooks
- 使用 CSS-in-JS 进行样式管理
- 遵循 ESLint 代码规范

## 浏览器支持

- Chrome ≥ 88
- Firefox ≥ 85
- Safari ≥ 14
- Edge ≥ 88