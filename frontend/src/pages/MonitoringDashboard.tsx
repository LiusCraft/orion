import React from 'react'
import { Row, Col, Card, Statistic, Progress, Table, Tag, Alert } from 'antd'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { WarningOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'

const MonitoringDashboard: React.FC = () => {
  const metricData = [
    { time: '00:00', errorRate: 0.5, responseTime: 120, qps: 1000 },
    { time: '01:00', errorRate: 0.3, responseTime: 110, qps: 950 },
    { time: '02:00', errorRate: 0.2, responseTime: 105, qps: 900 },
    { time: '03:00', errorRate: 0.4, responseTime: 115, qps: 850 },
    { time: '04:00', errorRate: 0.6, responseTime: 125, qps: 920 },
    { time: '05:00', errorRate: 1.2, responseTime: 180, qps: 880 },
    { time: '06:00', errorRate: 2.5, responseTime: 220, qps: 1200 }
  ]

  const currentMetrics = [
    {
      key: '1',
      metric: '错误率',
      current: 2.5,
      baseline: 0.8,
      threshold: 1.0,
      status: 'critical',
      trend: 'up'
    },
    {
      key: '2',
      metric: '响应时间(P99)',
      current: 220,
      baseline: 150,
      threshold: 200,
      status: 'warning',
      trend: 'up'
    },
    {
      key: '3',
      metric: 'QPS',
      current: 1200,
      baseline: 1000,
      threshold: 1500,
      status: 'normal',
      trend: 'up'
    },
    {
      key: '4',
      metric: 'CPU使用率',
      current: 65,
      baseline: 50,
      threshold: 80,
      status: 'normal',
      trend: 'up'
    }
  ]

  const metricColumns = [
    {
      title: '指标',
      dataIndex: 'metric',
      key: 'metric',
    },
    {
      title: '当前值',
      dataIndex: 'current',
      key: 'current',
      render: (value: number, record: any) => (
        <span style={{ 
          fontWeight: 'bold',
          color: record.status === 'critical' ? '#ff4d4f' : 
                 record.status === 'warning' ? '#fa8c16' : '#52c41a'
        }}>
          {value}{record.metric.includes('率') ? '%' : record.metric.includes('时间') ? 'ms' : ''}
        </span>
      )
    },
    {
      title: '基线',
      dataIndex: 'baseline',
      key: 'baseline',
    },
    {
      title: '阈值',
      dataIndex: 'threshold',
      key: 'threshold',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          normal: { color: 'green', text: '正常' },
          warning: { color: 'orange', text: '警告' },
          critical: { color: 'red', text: '严重' }
        }
        const config = statusConfig[status as keyof typeof statusConfig]
        return <Tag color={config.color}>{config.text}</Tag>
      }
    },
    {
      title: '趋势',
      dataIndex: 'trend',
      key: 'trend',
      render: (trend: string) => (
        trend === 'up' ? 
          <ArrowUpOutlined style={{ color: '#ff4d4f' }} /> : 
          <ArrowDownOutlined style={{ color: '#52c41a' }} />
      )
    }
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="异常指标"
              value={2}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="监控应用"
              value={15}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="数据采集频率"
              value={30}
              valueStyle={{ color: '#52c41a' }}
              suffix="秒"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="监控覆盖率"
              value={92.5}
              precision={1}
              valueStyle={{ color: '#52c41a' }}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 指标图表 */}
        <Col xs={24} lg={16}>
          <Card title="核心指标趋势" bordered={false}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metricData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="errorRate" 
                  stroke="#ff4d4f" 
                  strokeWidth={2}
                  name="错误率(%)"
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="responseTime" 
                  stroke="#1890ff" 
                  strokeWidth={2}
                  name="响应时间(ms)"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="qps" 
                  stroke="#52c41a" 
                  strokeWidth={2}
                  name="QPS"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* 当前指标状态 */}
        <Col xs={24} lg={8}>
          <Card title="当前指标状态" bordered={false}>
            <Table
              columns={metricColumns}
              dataSource={currentMetrics}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* 告警信息 */}
      <Alert
        style={{ marginTop: '24px' }}
        message="检测到异常模式"
        description="错误率在06:00开始显著上升，与响应时间增加相关，建议立即检查用户服务发布情况"
        type="warning"
        showIcon
      />
    </div>
  )
}

export default MonitoringDashboard