import React from "react";
import { Row, Col, Card, Statistic, List, Tag, Alert } from "antd";
import {
  ArrowUpOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { GuardDutyTask, Alert as AlertType } from "../types";

const Dashboard: React.FC = () => {
  const activeTasks: GuardDutyTask[] = [
    {
      id: "1",
      name: "用户服务发布保障",
      application: "user-service",
      status: "running",
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
      duration: 30,
      metrics: [],
      alerts: [],
      deploymentId: "DEP-2024-001",
      createdBy: "张三",
    },
    {
      id: "2",
      name: "订单服务配置变更",
      application: "order-service",
      status: "warning",
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 7200000).toISOString(),
      duration: 45,
      metrics: [],
      alerts: [
        {
          id: "alert-1",
          severity: "P1",
          message: "响应时间超过阈值",
          timestamp: new Date().toISOString(),
          acknowledged: false,
          source: "Prometheus",
          metricName: "response_time",
        },
      ],
      createdBy: "李四",
    },
  ];

  const criticalAlerts: AlertType[] = [
    {
      id: "alert-1",
      severity: "P0",
      message: "支付服务错误率超过10%",
      timestamp: new Date().toISOString(),
      acknowledged: false,
      source: "Alertmanager",
      metricName: "error_rate",
    },
    {
      id: "alert-2",
      severity: "P1",
      message: "数据库连接池饱和",
      timestamp: new Date().toISOString(),
      acknowledged: true,
      source: "Grafana",
      metricName: "connection_pool",
    },
  ];

  const getStatusTag = (status: string) => {
    const statusConfig = {
      running: { color: "blue", text: "运行中" },
      completed: { color: "green", text: "已完成" },
      warning: { color: "orange", text: "警告" },
      critical: { color: "red", text: "严重" },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getSeverityTag = (severity: string) => {
    const severityConfig = {
      P0: { color: "red", text: "P0-紧急" },
      P1: { color: "orange", text: "P1-重要" },
      P2: { color: "yellow", text: "P2-警告" },
      P3: { color: "blue", text: "P3-信息" },
    };
    const config = severityConfig[severity as keyof typeof severityConfig];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  return (
    <div style={{ padding: "24px" }}>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="运行中任务"
              value={8}
              valueStyle={{ color: "#1890ff" }}
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日告警"
              value={12}
              valueStyle={{ color: "#cf1322" }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="任务成功率"
              value={98.7}
              precision={1}
              valueStyle={{ color: "#3f8600" }}
              prefix={<CheckCircleOutlined />}
              suffix="%"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="平均响应时间"
              value={45}
              valueStyle={{ color: "#1890ff" }}
              suffix="秒"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 当前任务列表 */}
        <Col xs={24} lg={12}>
          <Card title="当前保障任务" bordered={false}>
            <List
              itemLayout="horizontal"
              dataSource={activeTasks}
              renderItem={(task) => (
                <List.Item
                  actions={[<a key="view">查看</a>, <a key="action">操作</a>]}
                >
                  <List.Item.Meta
                    title={
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span>{task.name}</span>
                        {getStatusTag(task.status)}
                      </div>
                    }
                    description={
                      <div>
                        <div>应用: {task.application}</div>
                        <div>创建人: {task.createdBy}</div>
                        <div>持续时间: {task.duration}分钟</div>
                        {task.deploymentId && (
                          <div>发布ID: {task.deploymentId}</div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* 紧急告警 */}
        <Col xs={24} lg={12}>
          <Card title="紧急告警" bordered={false}>
            <List
              itemLayout="horizontal"
              dataSource={criticalAlerts}
              renderItem={(alert) => (
                <List.Item
                  actions={[
                    <a key="ack">{alert.acknowledged ? "已确认" : "确认"}</a>,
                    <a key="view">处理</a>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span>{alert.message}</span>
                        {getSeverityTag(alert.severity)}
                      </div>
                    }
                    description={
                      <div>
                        <div>来源: {alert.source}</div>
                        <div>
                          时间: {new Date(alert.timestamp).toLocaleString()}
                        </div>
                        {alert.metricName && (
                          <div>指标: {alert.metricName}</div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 系统状态提示 */}
      <Alert
        style={{ marginTop: "24px" }}
        message="系统状态正常"
        description="所有监控组件运行正常，最近24小时无系统级故障"
        type="success"
        showIcon
      />
    </div>
  );
};

export default Dashboard;
