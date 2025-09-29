import React from 'react'
import { Card, Typography } from 'antd'

const { Title, Paragraph } = Typography

const KnowledgePage: React.FC = () => {
  return (
    <div>
      <Card>
        <Title level={2}>知识库</Title>
        <Paragraph>
          这里是CDN知识库管理系统，您可以浏览和管理CDN相关的文档资料。
        </Paragraph>
        <Paragraph type="secondary">
          知识库功能正在开发中，敬请期待...
        </Paragraph>
      </Card>
    </div>
  )
}

export default KnowledgePage