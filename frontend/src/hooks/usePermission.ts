import { useAuthStore } from "../store/authStore";
import type { Permission } from "../constants/permissions";
import { ROLES } from "../constants/permissions";

// 权限检查Hook
export const usePermission = () => {
  const { user } = useAuthStore();

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;

    // 管理员拥有所有权限
    if (user.role === ROLES.ADMIN) return true;

    // TODO: 实现具体的权限检查逻辑
    // 这里可以根据用户角色和权限进行更复杂的判断
    console.log("Checking permission:", permission);

    return false;
  };

  const hasRole = (role: string | string[]): boolean => {
    if (!user) return false;

    const requiredRoles = Array.isArray(role) ? role : [role];
    return requiredRoles.includes(user.role);
  };

  const isAdmin = (): boolean => {
    return user?.role === ROLES.ADMIN;
  };

  return {
    hasPermission,
    hasRole,
    isAdmin,
    user,
  };
};
