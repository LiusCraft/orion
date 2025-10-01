import React from 'react'
import { Outlet } from 'react-router-dom'
import { Layout, Card } from 'antd'

const { Content } = Layout

const AuthLayout: React.FC = () => {
  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <Content style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px'
      }}>
        <Card
          style={{
            width: '100%',
            maxWidth: 400,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
          bodyStyle={{ padding: '40px' }}
        >
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#1890ff',
              margin: 0
            }}>
              工程效能 AI 助手
            </h1>
            <p style={{ color: '#666', marginTop: '8px' }}>
              面向研发、运维、技术支持的效率助手
            </p>
          </div>
          <Outlet />
        </Card>
      </Content>
    </Layout>
  )
}

export default AuthLayout
