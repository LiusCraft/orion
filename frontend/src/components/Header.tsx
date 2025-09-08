import React from "react";
import { Layout, Typography, Space, Badge, Avatar, Dropdown } from "antd";
import { BellOutlined, UserOutlined } from "@ant-design/icons";

const { Header: AntHeader } = Layout;
const { Title } = Typography;

const Header: React.FC = () => {
  const notifications = [
    { id: "1", message: "新告警: 用户服务错误率上升", read: false },
    { id: "2", message: "发布任务 #123 已完成", read: true },
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AntHeader
      style={{
        background: "#fff",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 4px rgba(0,21,41,0.12)",
      }}
    >
      <Space>
        <Title level={3} style={{ margin: 0, color: "#1890ff" }}>
          🛡️ Orion
        </Title>
        <span style={{ color: "#666", fontSize: "14px" }}>
          智能运维主动保障平台
        </span>
      </Space>

      <Space size="middle">
        <Dropdown
          menu={{
            items: notifications.map((notif) => ({
              key: notif.id,
              label: (
                <div
                  style={{
                    padding: "8px 0",
                    borderBottom: "1px solid #f0f0f0",
                    opacity: notif.read ? 0.6 : 1,
                  }}
                >
                  <div>{notif.message}</div>
                  <div style={{ fontSize: "12px", color: "#999" }}>
                    {new Date().toLocaleTimeString()}
                  </div>
                </div>
              ),
            })),
          }}
          placement="bottomRight"
        >
          <Badge count={unreadCount}>
            <BellOutlined style={{ fontSize: "18px", cursor: "pointer" }} />
          </Badge>
        </Dropdown>

        <Dropdown
          menu={{
            items: [
              { key: "profile", label: "个人信息" },
              { key: "settings", label: "设置" },
              { key: "logout", label: "退出登录" },
            ],
          }}
          placement="bottomRight"
        >
          <Avatar
            size="default"
            icon={<UserOutlined />}
            style={{ cursor: "pointer" }}
          />
        </Dropdown>
      </Space>
    </AntHeader>
  );
};

export default Header;
