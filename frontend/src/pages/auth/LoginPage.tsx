import React, { useState } from 'react'
import { Form, Input, Button, message, Card, Divider, Space, Alert } from 'antd'
import { UserOutlined, LockOutlined, RobotOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authService } from '../../services/authService'
import { useAuthStore } from '../../store/authStore'
import type { LoginRequest } from '../../types'

const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [form] = Form.useForm()
  const [isDemo, setIsDemo] = useState(false)

  // 模拟登录（用于演示）
  const handleDemoLogin = (role: 'admin' | 'user') => {
    const demoUser = {
      id: role === 'admin' ? 'admin-001' : 'user-001',
      username: role === 'admin' ? 'admin' : 'demo_user',
      email: role === 'admin' ? 'admin@cdnagent.com' : 'user@cdnagent.com',
      displayName: role === 'admin' ? '系统管理员' : '演示用户',
      role: role,
      department: 'CDN技术部',
      status: 'active',
      lastLoginAt: new Date().toISOString()
    }

    login('demo-access-token', 'demo-refresh-token', demoUser)
    message.success(`以${role === 'admin' ? '管理员' : '普通用户'}身份登录成功`)
    navigate('/chat')
  }

  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: (data) => {
      login(data.accessToken, data.refreshToken, data.user)
      message.success('登录成功')
      navigate('/chat')
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      message.error(error?.response?.data?.message || '登录失败')
    },
  })

  const handleSubmit = (values: LoginRequest) => {
    if (isDemo) {
      // 演示模式，直接模拟登录
      if (values.username === 'admin' && values.password === 'admin123') {
        handleDemoLogin('admin')
      } else if (values.username === 'demo' && values.password === 'demo123') {
        handleDemoLogin('user')
      } else {
        message.error('演示账户用户名或密码错误')
      }
    } else {
      loginMutation.mutate(values)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <RobotOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
        <h1 style={{ fontSize: '24px', margin: 0, color: '#1890ff' }}>CDN AI Agent</h1>
        <p style={{ color: '#666', margin: '8px 0 0 0' }}>智能CDN运维助手</p>
      </div>

      {isDemo && (
        <Alert
          message="演示模式"
          description="您当前处于演示模式，可以使用以下账户体验系统功能"
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      <Form
        form={form}
        name="login"
        onFinish={handleSubmit}
        autoComplete="off"
        size="large"
        layout="vertical"
      >
        <Form.Item
          label="用户名"
          name="username"
          rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, message: '用户名至少3个字符' },
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="请输入用户名"
            autoComplete="username"
          />
        </Form.Item>

        <Form.Item
          label="密码"
          name="password"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少6个字符' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入密码"
            autoComplete="current-password"
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loginMutation.isPending}
            style={{ width: '100%' }}
          >
            登录
          </Button>
        </Form.Item>
      </Form>

      <Divider>或</Divider>

      <Card title="演示账户" size="small" style={{ marginBottom: '16px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>管理员账户</div>
              <div style={{ fontSize: '12px', color: '#666' }}>用户名: admin, 密码: admin123</div>
            </div>
            <Button 
              size="small" 
              onClick={() => {
                form.setFieldsValue({ username: 'admin', password: 'admin123' })
                setIsDemo(true)
              }}
            >
              填充
            </Button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>普通用户</div>
              <div style={{ fontSize: '12px', color: '#666' }}>用户名: demo, 密码: demo123</div>
            </div>
            <Button 
              size="small" 
              onClick={() => {
                form.setFieldsValue({ username: 'demo', password: 'demo123' })
                setIsDemo(true)
              }}
            >
              填充
            </Button>
          </div>
        </Space>
      </Card>

      <div style={{ textAlign: 'center' }}>
        <span style={{ color: '#666' }}>还没有账户？</span>
        <Link to="/auth/register" style={{ marginLeft: '8px' }}>
          立即注册
        </Link>
      </div>

      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <Card size="small">
          <div style={{ fontSize: '12px', color: '#666' }}>
            <p style={{ margin: '4px 0' }}>💡 <strong>功能特性</strong></p>
            <p style={{ margin: '4px 0' }}>• 智能问答：CDN技术问题快速解答</p>
            <p style={{ margin: '4px 0' }}>• 工具集成：监控、日志、API一体化</p>
            <p style={{ margin: '4px 0' }}>• 知识管理：文档库统一管理</p>
            <p style={{ margin: '4px 0' }}>• 实时协作：多人协同工作</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default LoginPage