# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Orion** is an intelligent operations assurance platform designed to automate monitoring and response during high-risk operations like deployments and configuration changes. It integrates with monitoring systems, alert platforms, and deployment systems to provide "autopilot"-like assurance for changes.

### Key Components (Based on PRD)
- **Guard Duty Tasks**: Core execution units that monitor applications/services during change windows
- **Data Integrations**: Prometheus, Alertmanager, deployment systems, monitoring tools
- **Monitoring & Alerting**: Multi-metric monitoring with intelligent baselines
- **Notification System**: Multi-channel (chat, SMS, email, voice) with escalation policies
- **Automated Actions**: One-click rollback, automated diagnosis,预案 execution

## Architecture Direction

Based on the PRD and MVP, the system will likely need:
- **Backend Service**: Likely Go or Java for high reliability requirements
- **Event Processing**: Real-time alert and metric processing pipeline
- **Integration Layer**: Adapters for various monitoring/alerting systems
- **Web UI**: For task management and dashboards
- **Database**: For task state, historical data, and configuration

## Development Setup

Since this is a new project, future development should:
1. **Choose Tech Stack**: Based on reliability (NF1) and performance (NF2) requirements
2. **Set Up CI/CD**: For the high reliability requirements (>99.9% success rate)
3. **Implement Core Integrations**: Alertmanager and deployment system integration first (M1, M2)
4. **Build Monitoring Pipeline**: Real-time metric processing with baseline comparison (M3)
5. **Add Notification System**: Multi-channel with escalation (M4)
6. **Implement Actions**: One-click operations with approval flows (M5)

## Key Integration Points
- **Alertmanager**: Webhook integration for real-time alert ingestion
- **Prometheus/Thanos**: Metrics querying for baseline comparison
- **Deployment Systems**: API integration for automatic task creation/termination
- **Chat Platforms**: DingTalk/Feishu webhook integration for notifications
- **SMS Gateways**: For critical alert escalation

## Testing Strategy
Given the reliability requirements:
- **Integration Tests**: For all external system integrations
- **Load Testing**: To ensure performance under thousands of concurrent tasks
- **Failure Testing**: To verify graceful degradation and recovery
- **End-to-End Tests**: For critical user workflows

## Security Considerations
- **API Authentication**: All integrations require proper auth
- **Action Authorization**: Strict controls for automated operations
- **Audit Logging**: Complete audit trail for all actions taken
- **Secret Management**: Secure handling of integration credentials