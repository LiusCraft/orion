import React from 'react'
import { Form, Input, Button, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authService } from '../../services/authService'
import { useAuthStore } from '../../store/authStore'
import type { LoginRequest } from '../../types'

const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [form] = Form.useForm()

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
    loginMutation.mutate(values)
  }

  return (
    <div>
      <Form
        form={form}
        name="login"
        onFinish={handleSubmit}
        autoComplete="off"
        size="large"
      >
        <Form.Item
          name="username"
          rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, message: '用户名至少3个字符' },
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="用户名"
            autoComplete="username"
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少6个字符' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="密码"
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

        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#666' }}>还没有账户？</span>
          <Link to="/auth/register" style={{ marginLeft: '8px' }}>
            立即注册
          </Link>
        </div>
      </Form>
    </div>
  )
}

export default LoginPage