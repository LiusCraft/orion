import React from "react";
import { Layout, Menu } from "antd";
import {
  DashboardOutlined,
  SafetyCertificateOutlined,
  AlertOutlined,
  BarChartOutlined,
  SettingOutlined,
} from "@ant-design/icons";

const { Sider } = Layout;

interface SidebarProps {
  onMenuClick: (key: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onMenuClick }) => {
  const menuItems = [
    {
      key: "dashboard",
      icon: <DashboardOutlined />,
      label: "总览仪表盘",
    },
    {
      key: "tasks",
      icon: <SafetyCertificateOutlined />,
      label: "保障任务",
      children: [
        { key: "active-tasks", label: "运行中任务" },
        { key: "task-templates", label: "任务模板" },
        { key: "history", label: "历史任务" },
      ],
    },
    {
      key: "monitoring",
      icon: <BarChartOutlined />,
      label: "监控观察",
      children: [
        { key: "metrics", label: "指标监控" },
        { key: "baselines", label: "基线管理" },
      ],
    },
    {
      key: "alerts",
      icon: <AlertOutlined />,
      label: "告警中心",
      children: [
        { key: "active-alerts", label: "当前告警" },
        { key: "alert-rules", label: "告警规则" },
      ],
    },
    {
      key: "action-center",
      icon: <SettingOutlined />,
      label: "操作中心",
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "系统设置",
      children: [
        { key: "integrations", label: "集成配置" },
        { key: "notifications", label: "通知设置" },
        { key: "users", label: "用户管理" },
      ],
    },
  ];

  return (
    <Sider
      width={250}
      style={{
        background: "#fff",
        boxShadow: "2px 0 6px rgba(0,21,41,0.35)",
      }}
    >
      <Menu
        mode="inline"
        defaultSelectedKeys={["dashboard"]}
        defaultOpenKeys={["tasks", "monitoring", "alerts", "settings"]}
        style={{ height: "100%", borderRight: 0 }}
        items={menuItems}
        onClick={({ key }) => onMenuClick(key)}
      />
    </Sider>
  );
};

export default Sidebar;
