import React, { useState } from "react";
import { Card, List, Button, Modal, message, Tag, Row, Col, Alert } from "antd";
import {
  RollbackOutlined,
  PauseOutlined,
  PlayCircleOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { Action } from "../types";

const ActionCenter: React.FC = () => {
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState<Action | null>(null);

  const pendingActions: Action[] = [
    {
      id: "1",
      type: "rollback",
      status: "pending",
      taskId: "task-123",
      requestedBy: "系统自动",
      requestedAt: new Date().toISOString(),
    },
    {
      id: "2",
      type: "pause",
      status: "pending",
      taskId: "task-456",
      requestedBy: "张三",
      requestedAt: new Date(Date.now() - 300000).toISOString(),
    },
  ];

  const recentActions: Action[] = [
    {
      id: "3",
      type: "rollback",
      status: "completed",
      taskId: "task-789",
      requestedBy: "李四",
      requestedAt: new Date(Date.now() - 1800000).toISOString(),
      executedAt: new Date(Date.now() - 1700000).toISOString(),
    },
  ];

  const getActionIcon = (type: string) => {
    const icons = {
      rollback: <RollbackOutlined style={{ color: "#ff4d4f" }} />,
      pause: <PauseOutlined style={{ color: "#fa8c16" }} />,
      restart: <PlayCircleOutlined style={{ color: "#52c41a" }} />,
      scale: <HistoryOutlined style={{ color: "#1890ff" }} />,
    };
    return icons[type as keyof typeof icons];
  };

  const getActionText = (type: string) => {
    const texts = {
      rollback: "回滚",
      pause: "暂停",
      restart: "重启",
      scale: "扩容",
    };
    return texts[type as keyof typeof texts];
  };

  const getStatusTag = (status: string) => {
    const statusConfig = {
      pending: { color: "orange", text: "待审批" },
      approved: { color: "blue", text: "已批准" },
      executing: { color: "purple", text: "执行中" },
      completed: { color: "green", text: "已完成" },
      failed: { color: "red", text: "失败" },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const handleAction = (action: Action, _: boolean) => {
    setCurrentAction(action);
    setIsConfirmVisible(true);
  };

  const confirmAction = () => {
    if (currentAction) {
      message.success(
        `已${currentAction.type === "rollback" ? "回滚" : "暂停"}操作`,
      );
      setIsConfirmVisible(false);
      setCurrentAction(null);
    }
  };

  const cancelAction = () => {
    setIsConfirmVisible(false);
    setCurrentAction(null);
  };

  return (
    <div style={{ padding: "24px" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="待处理操作" bordered={false}>
            <List
              itemLayout="horizontal"
              dataSource={pendingActions}
              renderItem={(action) => (
                <List.Item
                  actions={[
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => handleAction(action, true)}
                    >
                      批准
                    </Button>,
                    <Button
                      size="small"
                      danger
                      onClick={() => handleAction(action, false)}
                    >
                      拒绝
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={getActionIcon(action.type)}
                    title={
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span>{getActionText(action.type)}操作</span>
                        {getStatusTag(action.status)}
                      </div>
                    }
                    description={
                      <div>
                        <div>任务ID: {action.taskId}</div>
                        <div>请求人: {action.requestedBy}</div>
                        <div>
                          时间: {new Date(action.requestedAt).toLocaleString()}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="最近操作记录" bordered={false}>
            <List
              itemLayout="horizontal"
              dataSource={recentActions}
              renderItem={(action) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={getActionIcon(action.type)}
                    title={
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span>{getActionText(action.type)}操作</span>
                        {getStatusTag(action.status)}
                      </div>
                    }
                    description={
                      <div>
                        <div>任务ID: {action.taskId}</div>
                        <div>执行人: {action.requestedBy}</div>
                        <div>
                          耗时:{" "}
                          {action.executedAt &&
                            `${Math.round((new Date(action.executedAt).getTime() - new Date(action.requestedAt).getTime()) / 1000)}秒`}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作统计 */}
      <Card title="操作统计" style={{ marginTop: "16px" }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#1890ff",
                }}
              >
                12
              </div>
              <div>今日操作数</div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#52c41a",
                }}
              >
                98%
              </div>
              <div>成功率</div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#fa8c16",
                }}
              >
                45s
              </div>
              <div>平均耗时</div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#ff4d4f",
                }}
              >
                2
              </div>
              <div>失败次数</div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 确认模态框 */}
      <Modal
        title="确认操作"
        open={isConfirmVisible}
        onOk={confirmAction}
        onCancel={cancelAction}
        okText="确认"
        cancelText="取消"
      >
        {currentAction && (
          <div>
            <p>是否确认执行以下操作？</p>
            <p>
              <strong>操作类型:</strong> {getActionText(currentAction.type)}
            </p>
            <p>
              <strong>任务ID:</strong> {currentAction.taskId}
            </p>
            <p>
              <strong>请求人:</strong> {currentAction.requestedBy}
            </p>
            {currentAction.type === "rollback" && (
              <Alert
                message="警告"
                description="回滚操作将恢复服务到上一个稳定版本，可能会影响用户体验"
                type="warning"
                showIcon
                style={{ marginTop: "16px" }}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ActionCenter;
