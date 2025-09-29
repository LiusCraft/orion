import React from 'react'
import { Card, Typography } from 'antd'

const { Title, Paragraph } = Typography

const ChatPage: React.FC = () => {
  return (
    <div>
      <Card>
        <Title level={2}>对话助手</Title>
        <Paragraph>
          欢迎使用CDN AI Agent！这里是智能对话功能。
        </Paragraph>
        <Paragraph type="secondary">
          对话界面正在开发中，敬请期待...
        </Paragraph>
      </Card>
    </div>
  )
}

export default ChatPage