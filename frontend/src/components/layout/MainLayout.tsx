import React, { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown, Space, Button } from 'antd'
import {
  MessageOutlined,
  BookOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ApiOutlined,
  ControlOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../../store/authStore'
import { authService } from '../../services/authService'
import { PermissionGuard, ROLES } from '../common/PermissionGuard'

const { Header, Sider, Content } = Layout

const MainLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)

  const menuItems = [
    {
      key: '/chat',
      icon: <MessageOutlined />,
      label: '对话助手',
    },
    {
      key: '/knowledge',
      icon: <BookOutlined />,
      label: '知识库',
    },
    {
      key: '/tools',
      icon: <ApiOutlined />,
      label: '工具集成',
    },
  ]

  // 如果是管理员，添加管理页面
  if (user?.role === ROLES.ADMIN) {
    menuItems.push({
      key: '/admin',
      icon: <ControlOutlined />,
      label: '系统管理',
    })
  }

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  const handleLogout = async () => {
    try {
      await authService.logout()
    } catch {
      // 即使请求失败也要清除本地状态
    } finally {
      logout()
      navigate('/auth/login')
    }
  }

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: () => {
        // TODO: 打开个人资料弹窗
      },
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  const getRoleBadge = (role: string) => {
    switch (role) {
      case ROLES.ADMIN:
        return { text: '管理员', color: '#f50' }
      case ROLES.USER:
        return { text: '用户', color: '#108ee9' }
      case ROLES.VIEWER:
        return { text: '访客', color: '#87d068' }
      default:
        return { text: '未知', color: '#999' }
    }
  }

  const roleBadge = user ? getRoleBadge(user.role) : null

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
        }}
      >
        <div style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <h2 style={{
            margin: 0,
            color: '#1890ff',
            fontSize: collapsed ? '16px' : '20px',
          }}>
            {collapsed ? 'CDN' : 'CDN AI Agent'}
          </h2>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ border: 'none' }}
        />
      </Sider>

      <Layout>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} src={user?.avatarURL} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ lineHeight: '16px' }}>{user?.displayName || user?.username}</span>
                {roleBadge && (
                  <span style={{ 
                    fontSize: '12px', 
                    color: roleBadge.color,
                    lineHeight: '14px'
                  }}>
                    {roleBadge.text}
                  </span>
                )}
              </div>
            </Space>
          </Dropdown>
        </Header>

        <Content style={{
          margin: '24px',
          padding: '24px',
          background: '#fff',
          borderRadius: '6px',
          overflow: 'auto',
        }}>
          <PermissionGuard
            fallback={
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '200px',
                flexDirection: 'column'
              }}>
                <h3>访问被拒绝</h3>
                <p>您没有权限访问此页面</p>
              </div>
            }
          >
            <Outlet />
          </PermissionGuard>
        </Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout