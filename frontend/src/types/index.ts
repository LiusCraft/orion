export interface GuardDutyTask {
  id: string;
  name: string;
  application: string;
  status: 'running' | 'completed' | 'warning' | 'critical';
  startTime: string;
  endTime: string;
  duration: number;
  metrics: Metric[];
  alerts: Alert[];
  deploymentId?: string;
  createdBy: string;
}

export interface Metric {
  name: string;
  value: number;
  baseline: number;
  threshold: number;
  status: 'normal' | 'warning' | 'critical';
  timestamp: string;
}

export interface Alert {
  id: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  source: string;
  metricName?: string;
}

export interface Notification {
  id: string;
  type: 'alert' | 'action' | 'info';
  message: string;
  timestamp: string;
  read: boolean;
  actionRequired?: boolean;
}

export interface Action {
  id: string;
  type: 'rollback' | 'scale' | 'restart' | 'pause';
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed';
  taskId: string;
  requestedBy?: string;
  requestedAt: string;
  executedAt?: string;
}