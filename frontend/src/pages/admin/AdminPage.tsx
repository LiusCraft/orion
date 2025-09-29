import React from 'react'
import { Card, Typography } from 'antd'

const { Title, Paragraph } = Typography

const AdminPage: React.FC = () => {
  return (
    <div>
      <Card>
        <Title level={2}>系统管理</Title>
        <Paragraph>
          这里是系统管理界面，您可以管理用户、配置和系统设置。
        </Paragraph>
        <Paragraph type="secondary">
          管理功能正在开发中，敬请期待...
        </Paragraph>
      </Card>
    </div>
  )
}

export default AdminPage