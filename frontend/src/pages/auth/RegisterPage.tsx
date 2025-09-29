import React from 'react'
import { Form, Input, Button, message } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, TeamOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authService } from '../../services/authService'
import { useAuthStore } from '../../store/authStore'
import type { RegisterRequest } from '../../types'

const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [form] = Form.useForm()

  const registerMutation = useMutation({
    mutationFn: authService.register,
    onSuccess: (data) => {
      login(data.accessToken, data.refreshToken, data.user)
      message.success('注册成功')
      navigate('/chat')
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      message.error(error?.response?.data?.message || '注册失败')
    },
  })

  const handleSubmit = (values: RegisterRequest) => {
    registerMutation.mutate(values)
  }

  return (
    <div>
      <Form
        form={form}
        name="register"
        onFinish={handleSubmit}
        autoComplete="off"
        size="large"
      >
        <Form.Item
          name="username"
          rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, max: 50, message: '用户名长度为3-50个字符' },
            { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' },
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="用户名"
            autoComplete="username"
          />
        </Form.Item>

        <Form.Item
          name="email"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]}
        >
          <Input
            prefix={<MailOutlined />}
            placeholder="邮箱"
            autoComplete="email"
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
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={['password']}
          rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('两次输入的密码不一致'))
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="确认密码"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item
          name="displayName"
          rules={[
            { max: 100, message: '显示名称不能超过100个字符' },
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="显示名称（可选）"
            autoComplete="name"
          />
        </Form.Item>

        <Form.Item
          name="department"
          rules={[
            { max: 50, message: '部门名称不能超过50个字符' },
          ]}
        >
          <Input
            prefix={<TeamOutlined />}
            placeholder="部门（可选）"
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={registerMutation.isPending}
            style={{ width: '100%' }}
          >
            注册
          </Button>
        </Form.Item>

        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#666' }}>已有账户？</span>
          <Link to="/auth/login" style={{ marginLeft: '8px' }}>
            立即登录
          </Link>
        </div>
      </Form>
    </div>
  )
}

export default RegisterPage