import React, { useState } from "react";
import {
  Card,
  List,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
} from "antd";
import {
  BellOutlined,
  MessageOutlined,
  MailOutlined,
  PhoneOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Notification } from "../types";

const NotificationCenter: React.FC = () => {
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);

  const notifications: Notification[] = [
    {
      id: "1",
      type: "alert",
      message: "【紧急告警】用户服务错误率超过5%，当前值: 8.2%",
      timestamp: new Date().toISOString(),
      read: false,
      actionRequired: true,
    },
    {
      id: "2",
      type: "action",
      message: "发布任务 #123 需要审批回滚操作",
      timestamp: new Date(Date.now() - 300000).toISOString(),
      read: true,
      actionRequired: true,
    },
    {
      id: "3",
      type: "info",
      message: "监控系统数据采集正常，最近1小时无异常",
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      read: true,
      actionRequired: false,
    },
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationIcon = (type: string) => {
    const icons = {
      alert: <BellOutlined style={{ color: "#ff4d4f" }} />,
      action: <MessageOutlined style={{ color: "#1890ff" }} />,
      info: <MailOutlined style={{ color: "#52c41a" }} />,
    };
    return icons[type as keyof typeof icons];
  };

  const getNotificationTag = (type: string) => {
    const tags = {
      alert: { color: "red", text: "告警" },
      action: { color: "blue", text: "操作" },
      info: { color: "green", text: "信息" },
    };
    const config = tags[type as keyof typeof tags];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const showSettings = () => {
    setIsSettingsVisible(true);
  };

  const handleSettingsOk = () => {
    setIsSettingsVisible(false);
  };

  const handleSettingsCancel = () => {
    setIsSettingsVisible(false);
  };

  return (
    <div style={{ padding: "24px" }}>
      <Card
        title={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>
              <BellOutlined style={{ marginRight: "8px" }} />
              通知中心
              {unreadCount > 0 && (
                <Tag color="red" style={{ marginLeft: "8px" }}>
                  {unreadCount}条未读
                </Tag>
              )}
            </span>
            <Button
              icon={<SettingOutlined />}
              size="small"
              onClick={showSettings}
            >
              通知设置
            </Button>
          </div>
        }
        bordered={false}
      >
        <List
          itemLayout="horizontal"
          dataSource={notifications}
          renderItem={(notification) => (
            <List.Item
              style={{
                opacity: notification.read ? 0.6 : 1,
                background: notification.read ? "#fafafa" : "#fff",
                padding: "12px 16px",
                borderBottom: "1px solid #f0f0f0",
              }}
              actions={[
                <Button type="link" size="small">
                  {notification.read ? "标记未读" : "标记已读"}
                </Button>,
                notification.actionRequired && (
                  <Button type="primary" size="small">
                    立即处理
                  </Button>
                ),
              ]}
            >
              <List.Item.Meta
                avatar={getNotificationIcon(notification.type)}
                title={
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span>{notification.message}</span>
                    {getNotificationTag(notification.type)}
                    {!notification.read && <Tag color="blue">未读</Tag>}
                  </div>
                }
                description={
                  <div>
                    <div>
                      时间: {new Date(notification.timestamp).toLocaleString()}
                    </div>
                    {notification.actionRequired && (
                      <div style={{ color: "#ff4d4f", marginTop: "4px" }}>
                        ⚠️ 需要立即处理
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />

        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            background: "#f5f5f5",
            borderRadius: "6px",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
            通知渠道状态:
          </div>
          <Space size="large">
            <div>
              <MessageOutlined
                style={{ color: "#52c41a", marginRight: "4px" }}
              />
              钉钉: 正常
            </div>
            <div>
              <MailOutlined style={{ color: "#52c41a", marginRight: "4px" }} />
              邮件: 正常
            </div>
            <div>
              <PhoneOutlined style={{ color: "#52c41a", marginRight: "4px" }} />
              短信: 正常
            </div>
          </Space>
        </div>
      </Card>

      {/* 通知设置模态框 */}
      <Modal
        title="通知设置"
        open={isSettingsVisible}
        onOk={handleSettingsOk}
        onCancel={handleSettingsCancel}
        width={600}
      >
        <Form layout="vertical">
          <Form.Item label="通知渠道" required>
            <Space direction="vertical" style={{ width: "100%" }}>
              <div>
                <Switch defaultChecked />
                <span style={{ marginLeft: "8px" }}>钉钉工作通知</span>
              </div>
              <div>
                <Switch defaultChecked />
                <span style={{ marginLeft: "8px" }}>邮件通知</span>
              </div>
              <div>
                <Switch defaultChecked />
                <span style={{ marginLeft: "8px" }}>短信通知</span>
              </div>
              <div>
                <Switch />
                <span style={{ marginLeft: "8px" }}>电话通知(紧急)</span>
              </div>
            </Space>
          </Form.Item>

          <Form.Item label="通知规则">
            <Select defaultValue="immediate" style={{ width: "100%" }}>
              <Select.Option value="immediate">立即通知</Select.Option>
              <Select.Option value="5min">5分钟延迟</Select.Option>
              <Select.Option value="batch">批量通知(每小时)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="免打扰时段">
            <Input.Group compact>
              <Select defaultValue="23" style={{ width: "80px" }}>
                {Array.from({ length: 24 }, (_, i) => (
                  <Select.Option key={i} value={i}>
                    {i.toString().padStart(2, "0")}
                  </Select.Option>
                ))}
              </Select>
              <span
                style={{
                  display: "inline-block",
                  padding: "0 8px",
                  lineHeight: "32px",
                }}
              >
                至
              </span>
              <Select defaultValue="7" style={{ width: "80px" }}>
                {Array.from({ length: 24 }, (_, i) => (
                  <Select.Option key={i} value={i}>
                    {i.toString().padStart(2, "0")}
                  </Select.Option>
                ))}
              </Select>
              <span
                style={{
                  display: "inline-block",
                  padding: "0 8px",
                  lineHeight: "32px",
                }}
              >
                时静音
              </span>
            </Input.Group>
          </Form.Item>

          <Form.Item label="紧急联系人">
            <Input.TextArea
              placeholder="请输入紧急联系人手机号，多个用逗号分隔"
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default NotificationCenter;
