import React, { useState } from 'react'
import { Layout, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import TaskManagement from './pages/TaskManagement'
import MonitoringDashboard from './pages/MonitoringDashboard'
import NotificationCenter from './components/NotificationCenter'
import ActionCenter from './components/ActionCenter'
import './App.css'

const { Content } = Layout

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard')

  const handleMenuClick = (key: string) => {
    setCurrentPage(key)
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />
      case 'tasks':
      case 'active-tasks':
      case 'task-templates':
      case 'history':
        return <TaskManagement />
      case 'monitoring':
      case 'metrics':
      case 'baselines':
        return <MonitoringDashboard />
      case 'alerts':
      case 'active-alerts':
        return <NotificationCenter />
      case 'action-center':
        return <ActionCenter />
      default:
        return <Dashboard />
    }
  }

  return (
    <ConfigProvider locale={zhCN}>
      <Layout style={{ minHeight: '100vh' }} className="app">
        <Header />
        <Layout>
          <Sidebar onMenuClick={handleMenuClick} />
          <Content style={{ 
            padding: '24px', 
            background: '#fff',
            marginLeft: '0'
          }}>
            {renderContent()}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  )
}

export default App