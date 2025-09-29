import React from "react";
import { useAuthStore } from "../../store/authStore";
import type { Permission } from "../../constants/permissions";

interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: Permission;
  role?: string | string[];
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  role,
  fallback = null,
}) => {
  const { user } = useAuthStore();

  if (!user) {
    return fallback;
  }

  // 角色检查
  if (role) {
    const requiredRoles = Array.isArray(role) ? role : [role];
    if (!requiredRoles.includes(user.role)) {
      return fallback;
    }
  }

  // 权限检查（这里可以根据实际需求扩展）
  if (permission) {
    // TODO: 实现具体的权限检查逻辑
    // 目前简化处理，管理员拥有所有权限
    if (user.role !== "admin" && permission.resource === "admin") {
      return fallback;
    }
  }

  return <>{children}</>;
};
