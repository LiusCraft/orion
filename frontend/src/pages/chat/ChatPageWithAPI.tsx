import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Card,
  Input,
  Button,
  Space,
  Avatar,
  List,
  Typography,
  Badge,
  Dropdown,
  Divider,
  message,
  Spin,
  Modal,
  Tooltip,
  Collapse,
  Tag,
} from "antd";
import {
  SendOutlined,
  UserOutlined,
  RobotOutlined,
  PlusOutlined,
  MoreOutlined,
  DeleteOutlined,
  EditOutlined,
  BookOutlined,
  ToolOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatService } from "../../services/chatService";
import { DEFAULT_CONVERSATION_TITLE } from "../../constants";
import type {
  Message as MessageType,
  Conversation,
  PaginationResponse,
} from "../../types";
import MarkdownRenderer from "../../components/common/MarkdownRenderer";

const { TextArea } = Input;
const { Text } = Typography;

// 工具调用元数据类型（用于历史消息中的工具结果渲染）
interface ToolMetadataItem {
  toolId?: string;
  createdAt?: string;
  displayName?: string;
  name?: string;
  toolType?: string;
  status?: "success" | "failed" | string;
  executionTimeMs?: number;
  inputParams?: Record<string, unknown>;
  outputResult?: Record<string, unknown>;
}

interface Reference {
  title: string;
  url: string;
  snippet: string;
}

const ChatPage: React.FC = () => {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [sseConnection, setSseConnection] = useState<EventSource | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingConversationId, setStreamingConversationId] = useState<
    string | null
  >(null);
  // 规划阶段可视化（新）
  const [planningActive, setPlanningActive] = useState(false);
  const [planningNotes, setPlanningNotes] = useState<string[]>([]);
  const [pendingUserMessage, setPendingUserMessage] = useState<string>("");
  const [pendingConversationId, setPendingConversationId] = useState<
    string | null
  >(null);
  const [loadingConversationId, setLoadingConversationId] = useState<
    string | null
  >(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<React.ComponentRef<typeof Input.TextArea>>(null);
  const queryClient = useQueryClient();

  // 获取对话列表
  const { data: conversationsData, isLoading: conversationsLoading } = useQuery(
    {
      queryKey: ["conversations"],
      queryFn: () => chatService.getConversations(1, 50),
    },
  );

  // 获取当前对话的消息
  const { data: currentConversation, isLoading: messagesLoading } = useQuery({
    queryKey: ["conversation", currentConversationId],
    queryFn: () =>
      currentConversationId
        ? chatService.getConversation(currentConversationId)
        : null,
    enabled: !!currentConversationId,
  });

  const currentConvObj: Conversation | undefined =
    currentConversation?.conversation;

  // 创建新对话
  const createConversationMutation = useMutation({
    mutationFn: chatService.createConversation,
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setCurrentConversationId(conversation.id);
      message.success("创建新对话成功");
    },
    onError: () => {
      message.error("创建对话失败");
    },
  });

  // 发送消息并开始流式响应
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: string; content: string }) => {
      // 发送用户消息
      const userMessage = await chatService.sendMessage(data.conversationId, {
        content: data.content,
      });

      // 立即开始AI流式响应，显式传入用户消息ID，避免错配
      startAIStreaming(data.conversationId, userMessage.id);

      return userMessage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["conversation", currentConversationId],
      });
      setPendingUserMessage("");
      setPendingConversationId(null);
    },
    onError: () => {
      message.error("发送消息失败");
      setIsLoading(false);
      setIsStreaming(false);
      setPendingUserMessage("");
    },
  });

  // 删除对话
  const deleteConversationMutation = useMutation({
    mutationFn: chatService.deleteConversation,
    onSuccess: (_data, deletedId: string) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      // 仅当删除的是当前会话时，清空当前会话ID
      if (deletedId === currentConversationId) setCurrentConversationId(null);
      message.success("删除对话成功");
    },
    onError: () => {
      message.error("删除对话失败");
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 检查用户是否在滚动条底部
  const isAtBottom = () => {
    if (!messagesContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    // 增大容差值到30px，更灵活地判断是否在底部
    // 这样即使用户稍微向上滚动一点，仍然能保持自动滚动
    return scrollHeight - scrollTop - clientHeight <= 50;
  };

  // 智能滚动：只有在底部时才自动滚动
  const smartScroll = useCallback(() => {
    if (isAtBottom()) {
      scrollToBottom();
    }
  }, []);

  // 开始AI流式响应
  const startAIStreaming = (conversationId: string, userMessageId?: string) => {
    setIsStreaming(true);
    setStreamingMessage("");
    setStreamingConversationId(conversationId);

    // 清理之前的连接
    if (sseConnection) {
      sseConnection.close();
    }

    // 创建新的SSE连接
    const eventSource = chatService.createChatStream(
      conversationId,
      userMessageId,
    );
    setSseConnection(eventSource);

    // 监听特定类型的事件
    eventSource.addEventListener("message_start", (event: MessageEvent) => {
      try {
        const eventData = JSON.parse(event.data);
        console.log("AI开始响应:", eventData.data);
        // 清空本次工具事件
        setToolEventCards([]);
        // 在消息开始时滚动到底部，显示占位气泡
        scrollToBottom();
      } catch (error) {
        console.error("解析message_start事件失败:", error);
      }
    });

    eventSource.addEventListener("content_delta", (event: MessageEvent) => {
      try {
        const eventData = JSON.parse(event.data);
        if (eventData.data.delta) {
          setStreamingMessage((prev) => prev + eventData.data.delta);
        }
      } catch (error) {
        console.error("解析content_delta事件失败:", error);
      }
    });

    eventSource.addEventListener("message_complete", (event: MessageEvent) => {
      try {
        const eventData = JSON.parse(event.data);
        console.log("AI响应完成:", eventData.data);
        setIsStreaming(false);
        setPlanningActive(false);
        setPlanningNotes([]);
        setStreamingMessage("");
        setStreamingConversationId((prev) =>
          prev === conversationId ? null : prev,
        );
        // 刷新消息列表以显示完整的AI回复
        queryClient.invalidateQueries({
          queryKey: ["conversation", conversationId],
        });
        // 刷新会话列表以获取可能的自动生成标题
        queryClient.invalidateQueries({
          queryKey: ["conversations"],
        });
      } catch (error) {
        console.error("解析message_complete事件失败:", error);
      }
    });

    // 可选：监听服务端发送的标题更新事件（无需等待刷新）
    eventSource.addEventListener(
      "conversation_title_updated",
      (event: MessageEvent) => {
        try {
          const eventData = JSON.parse(event.data);
          const convId: string | undefined = eventData?.data?.conversationId;
          // 刷新对话列表与对应会话详情，确保右侧标题同步更新
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          if (convId) {
            queryClient.invalidateQueries({
              queryKey: ["conversation", convId],
            });
          }
        } catch (error) {
          console.error("解析conversation_title_updated事件失败:", error);
        }
      },
    );

    // 模型侧错误事件（自定义名，避免与连接错误冲突）
    eventSource.addEventListener("ai_error", (event: MessageEvent) => {
      try {
        const eventData = JSON.parse(event.data);
        console.error("AI响应错误:", eventData.data);
        setIsStreaming(false);
        setPlanningActive(false);
        setPlanningNotes([]);
        setStreamingMessage("");
        setStreamingConversationId((prev) =>
          prev === conversationId ? null : prev,
        );
        message.error(`AI响应错误: ${eventData.data.error}`);
        // 关闭连接并刷新消息，展示已保存的部分内容
        eventSource.close();
        setSseConnection(null);
        queryClient.invalidateQueries({
          queryKey: ["conversation", conversationId],
        });
      } catch (error) {
        console.error("解析error事件失败:", error);
      }
    });

    // 通用错误处理
    eventSource.onerror = (error) => {
      console.error("SSE连接错误:", error);
      setIsStreaming(false);
      setPlanningActive(false);
      setPlanningNotes([]);
      setStreamingMessage("");
      eventSource.close();
      setSseConnection(null);
      setStreamingConversationId((prev) =>
        prev === conversationId ? null : prev,
      );
      // 刷新消息以获取已持久化的部分内容
      queryClient.invalidateQueries({
        queryKey: ["conversation", conversationId],
      });
    };

    // 监听done事件
    eventSource.addEventListener("done", () => {
      setIsStreaming(false);
      setPlanningActive(false);
      setPlanningNotes([]);
      setStreamingMessage("");
      eventSource.close();
      setSseConnection(null);
      setStreamingConversationId((prev) =>
        prev === conversationId ? null : prev,
      );
    });

    // 工具调用开始
    eventSource.addEventListener("tool_call_started", (event: MessageEvent) => {
      try {
        const eventData = JSON.parse(event.data);
        const data = eventData.data || {};
        setToolEventCards((prev) => [
          ...prev,
          {
            toolName: data.toolName,
            args:
              typeof data.args === "string"
                ? data.args
                : JSON.stringify(data.args ?? {}),
            status: "running",
            startedAt: data.timestamp,
          },
        ]);
      } catch (err) {
        console.error("解析tool_call_started事件失败:", err);
      }
    });

    // 工具调用结束
    eventSource.addEventListener(
      "tool_call_finished",
      (event: MessageEvent) => {
        try {
          const eventData = JSON.parse(event.data);
          const data = eventData.data || {};
          setToolEventCards((prev) => {
            const idx = [...prev]
              .reverse()
              .findIndex(
                (t) => t.toolName === data.toolName && t.status === "running",
              );
            if (idx === -1) {
              return [
                ...prev,
                {
                  toolName: data.toolName,
                  status: data.status,
                  durationMs: data.durationMs,
                  resultPreview:
                    typeof (data.resultPreview || data.result) === "string"
                      ? data.resultPreview || data.result
                      : JSON.stringify(data.resultPreview || data.result || {}),
                  error: data.error,
                },
              ];
            }
            const realIdx = prev.length - 1 - idx;
            const copy = prev.slice();
            copy[realIdx] = {
              ...copy[realIdx],
              status: data.status,
              durationMs: data.durationMs,
              resultPreview:
                typeof (data.resultPreview || data.result) === "string"
                  ? data.resultPreview || data.result
                  : JSON.stringify(data.resultPreview || data.result || {}),
              error: data.error,
            };
            return copy;
          });
        } catch (err) {
          console.error("解析tool_call_finished事件失败:", err);
        }
      },
    );

    // 规划阶段事件（新）
    eventSource.addEventListener("planning_start", (event: MessageEvent) => {
      try {
        const eventData = JSON.parse(event.data);
        setPlanningActive(true);
        const data = eventData.data || {};
        setPlanningNotes([
          `开始规划：intent=${data.intentDetected ? "是" : "否"}`,
        ]);
      } catch (err) {
        console.error("解析planning_start事件失败:", err);
      }
    });

    eventSource.addEventListener("tools_loading_start", () => {
      setPlanningNotes((prev) => [...prev, "加载工具中…"]);
    });

    eventSource.addEventListener(
      "tools_loading_finished",
      (event: MessageEvent) => {
        try {
          const eventData = JSON.parse(event.data);
          const n = eventData?.data?.toolCount ?? 0;
          setPlanningNotes((prev) => [...prev, `工具加载完成：${n} 个可用`]);
        } catch (err) {
          console.error("解析tools_loading_finished事件失败:", err);
        }
      },
    );

    eventSource.addEventListener(
      "model_step_started",
      (event: MessageEvent) => {
        try {
          const eventData = JSON.parse(event.data);
          const iter = eventData?.data?.iteration ?? 0;
          setPlanningNotes((prev) => [...prev, `第 ${iter} 轮规划…`]);
        } catch (err) {
          console.error("解析model_step_started事件失败:", err);
        }
      },
    );

    eventSource.addEventListener(
      "model_step_finished",
      (event: MessageEvent) => {
        try {
          const eventData = JSON.parse(event.data);
          const iter = eventData?.data?.iteration ?? 0;
          const has = eventData?.data?.hasToolCalls
            ? "产生工具调用"
            : "未产生工具调用";
          setPlanningNotes((prev) => [...prev, `第 ${iter} 轮完成：${has}`]);
        } catch (err) {
          console.error("解析model_step_finished事件失败:", err);
        }
      },
    );

    eventSource.addEventListener("planning_finished", (event: MessageEvent) => {
      try {
        const eventData = JSON.parse(event.data);
        const skipped = !!eventData?.data?.skipped;
        setPlanningNotes((prev) => [
          ...prev,
          skipped ? "已跳过规划" : "规划完成",
        ]);
      } catch (err) {
        console.error("解析planning_finished事件失败:", err);
      }
      setPlanningActive(false);
    });
  };

  useEffect(() => {
    // 流式消息变化时：仅当当前对话正在流式时才跟随滚动
    if (
      streamingMessage &&
      isStreaming &&
      streamingConversationId &&
      streamingConversationId === currentConversationId
    ) {
      smartScroll();
    }
  }, [
    streamingMessage,
    isStreaming,
    smartScroll,
    streamingConversationId,
    currentConversationId,
  ]);

  // 切换会话时退出编辑态
  useEffect(() => {
    setIsEditingTitle(false);
    setTitleDraft("");
  }, [currentConversationId]);

  // 初次加载消息数据时强制滚动到底部
  useEffect(() => {
    if (currentConversation?.messages?.data && !isStreaming) {
      scrollToBottom();
    }
  }, [currentConversation?.messages?.data, isStreaming]);

  // 用户发送的消息显示时强制滚动到底部
  useEffect(() => {
    if (pendingUserMessage && pendingConversationId === currentConversationId) {
      scrollToBottom();
    }
  }, [pendingUserMessage, pendingConversationId, currentConversationId]);

  // 初始化：如果没有对话且有对话列表，选择第一个
  useEffect(() => {
    if (
      !currentConversationId &&
      conversationsData?.data &&
      conversationsData.data.length > 0
    ) {
      setCurrentConversationId(conversationsData.data[0].id);
    }
  }, [conversationsData, currentConversationId]);

  // 清理SSE连接
  useEffect(() => {
    return () => {
      if (sseConnection) {
        sseConnection.close();
      }
    };
  }, [sseConnection]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !currentConversationId) return;

    const messageContent = inputValue.trim();
    setIsLoading(true);
    setLoadingConversationId(currentConversationId);

    // 立即显示用户消息
    setPendingUserMessage(messageContent);
    setPendingConversationId(currentConversationId);
    setInputValue("");

    try {
      await sendMessageMutation.mutateAsync({
        conversationId: currentConversationId,
        content: messageContent,
      });
    } finally {
      setIsLoading(false);
      setLoadingConversationId(null);
    }
  };

  const handleNewConversation = async () => {
    // 先刷新对话列表，避免使用过期数据
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    await queryClient.refetchQueries({ queryKey: ["conversations"] });

    const latest = queryClient.getQueryData<PaginationResponse<Conversation>>([
      "conversations",
    ]);
    const existing = latest?.data?.find(
      (c) =>
        (c.title === DEFAULT_CONVERSATION_TITLE || !c.title) &&
        c.status === "active" &&
        c.totalMessages === 0,
    );
    if (existing) {
      setCurrentConversationId(existing.id);
      message.info("已切换到现有空对话");
      return;
    }
    createConversationMutation.mutate(DEFAULT_CONVERSATION_TITLE);
  };

  const handleDeleteConversation = (conversationId: string) => {
    deleteConversationMutation.mutate(conversationId);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const conversationMenuItems = [
    {
      key: "rename",
      icon: <EditOutlined />,
      label: "重命名",
    },
    {
      key: "delete",
      icon: <DeleteOutlined />,
      label: "删除对话",
      danger: true,
    },
  ];

  const handleRenameConversation = (conv: Conversation) => {
    let newTitle = conv.title || "";
    Modal.confirm({
      title: "重命名对话",
      content: (
        <Input
          defaultValue={newTitle}
          onChange={(e) => (newTitle = e.target.value)}
          placeholder="请输入新的对话标题"
          autoFocus
          maxLength={200}
          allowClear
        />
      ),
      okText: "保存",
      cancelText: "取消",
      async onOk() {
        const title = (newTitle || "").trim() || DEFAULT_CONVERSATION_TITLE;
        await chatService.updateConversationTitle(conv.id, title);
        message.success("标题已更新");
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        if (conv.id === currentConversationId) {
          queryClient.invalidateQueries({
            queryKey: ["conversation", conv.id],
          });
        }
      },
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // 右侧标题编辑
  const beginEditTitle = () => {
    if (!currentConvObj || !currentConversationId) return;
    setIsEditingTitle(true);
    setTitleDraft(currentConvObj.title || DEFAULT_CONVERSATION_TITLE);
  };

  const saveEditTitle = async () => {
    if (!currentConversationId) {
      setIsEditingTitle(false);
      return;
    }
    const newTitle = (titleDraft || "").trim() || DEFAULT_CONVERSATION_TITLE;
    if (currentConvObj && newTitle === currentConvObj.title) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await chatService.updateConversationTitle(
        currentConversationId,
        newTitle,
      );
      message.success("标题已更新");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({
        queryKey: ["conversation", currentConversationId],
      });
    } catch {
      message.error("更新标题失败");
    } finally {
      setIsEditingTitle(false);
    }
  };

  const cancelEditTitle = () => {
    setIsEditingTitle(false);
    setTitleDraft("");
  };

  // 计算消息耗时（ms）：优先使用 updatedAt，否则用当前时间
  const computeDurationMs = (msg: MessageType): number => {
    const start = new Date(msg.createdAt).getTime();
    const end = msg.updatedAt ? new Date(msg.updatedAt).getTime() : Date.now();
    return Math.max(0, end - start);
  };

  const [openToolPanels, setOpenToolPanels] = useState<
    Record<string, string | undefined>
  >({});

  const renderMessage = (message: MessageType) => {
    const isUser = message.senderType === "user";

    return (
      <div key={message.id} style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexDirection: isUser ? "row-reverse" : "row",
          }}
        >
          <Avatar
            size={32}
            icon={isUser ? <UserOutlined /> : <RobotOutlined />}
            style={{
              backgroundColor: isUser ? "#1890ff" : "#52c41a",
              flexShrink: 0,
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: isUser ? "flex-end" : "flex-start",
              maxWidth: "70%",
            }}
          >
            <div
              style={{
                background: isUser ? "#1890ff" : "#fff",
                color: isUser ? "#fff" : "#000",
                padding: "12px 16px",
                borderRadius: "12px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                marginBottom: "4px",
                maxWidth: "fit-content",
                minWidth: "20px",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              {isUser ? (
                <span style={{ whiteSpace: "pre-wrap" }}>
                  {message.content}
                </span>
              ) : (
                <MarkdownRenderer content={message.content} />
              )}
            </div>

            {!isUser &&
            message.content &&
            (message.status === "completed" ||
              message.status === "failed" ||
              message.status === "partial") ? (
              <div
                style={{ fontSize: "12px", color: "#999", margin: "2px 0 0 0" }}
              >
                {`耗时: ${Math.round(computeDurationMs(message) / 1000)}s`}
              </div>
            ) : null}

            {!isUser &&
            (message.status === "failed" || message.status === "partial") &&
            message.content ? (
              <div
                style={{
                  fontSize: "12px",
                  color: "#faad14",
                  marginTop: "2px",
                }}
              >
                生成中断：以下为已生成的部分内容
              </div>
            ) : null}

            {/* 工具调用结果（历史）：从 metadata.tools 渲染，可展开查看输入/输出 */}
            {message.metadata?.tools &&
            Array.isArray(message.metadata.tools) ? (
              <div style={{ marginTop: 8, width: "100%" }}>
                <Collapse
                  size="small"
                  activeKey={
                    openToolPanels[message.id]
                      ? [openToolPanels[message.id] as string]
                      : undefined
                  }
                  destroyInactivePanel
                  onChange={(keys) => {
                    const arr = Array.isArray(keys)
                      ? (keys as string[])
                      : [keys as string];
                    const k = arr.length > 0 ? arr[0] : undefined;
                    setOpenToolPanels((prev) => ({ ...prev, [message.id]: k }));
                  }}
                >
                  {Array.isArray(message.metadata.tools)
                    ? (message.metadata.tools as unknown as ToolMetadataItem[]).map(
                        (t: ToolMetadataItem, idx: number) => {
                      const panelKey = `${t.toolId || ""}:${t.createdAt || idx}`;
                      return (
                        <Collapse.Panel
                          key={panelKey}
                          header={
                            <Space>
                              <ToolOutlined />
                              <Text strong>{t.displayName || t.name}</Text>
                              {t.toolType && (
                                <Tag
                                  color="blue"
                                  style={{ textTransform: "uppercase" }}
                                >
                                  {t.toolType}
                                </Tag>
                              )}
                              <Tag
                                color={
                                  t.status === "success"
                                    ? "green"
                                    : t.status === "failed"
                                      ? "red"
                                      : "orange"
                                }
                              >
                                {t.status}
                              </Tag>
                              <Text type="secondary">
                                {(t.executionTimeMs ?? 0) + " ms"}
                              </Text>
                            </Space>
                          }
                        >
                          <div style={{ fontSize: 12, color: "#666" }}>
                            <div style={{ marginBottom: 6 }}>输入参数:</div>
                            <pre
                              style={{
                                background: "#f7f7f7",
                                padding: 8,
                                borderRadius: 6,
                                overflow: "auto",
                                maxHeight: 220,
                              }}
                            >
                              {JSON.stringify(t.inputParams || {}, null, 2)}
                            </pre>
                            <div style={{ marginTop: 8, marginBottom: 6 }}>
                              输出结果:
                            </div>
                            <pre
                              style={{
                                background: "#f7f7f7",
                                padding: 8,
                                borderRadius: 6,
                                overflow: "auto",
                                maxHeight: 220,
                              }}
                            >
                              {JSON.stringify(t.outputResult || {}, null, 2)}
                            </pre>
                          </div>
                        </Collapse.Panel>
                      );
                        },
                      )
                    : null}
                </Collapse>
              </div>
            ) : null}

            {/* 知识库引用 - 从 metadata 中解析 */}
            {message.metadata?.references &&
            Array.isArray(message.metadata.references) ? (
              <div style={{ marginTop: "8px" }}>
                {(message.metadata.references as Reference[]).map(
                  (ref: Reference, index: number) => (
                    <Card
                      key={index}
                      size="small"
                      style={{ marginBottom: "8px" }}
                    >
                      <Space>
                        <BookOutlined />
                        <Text strong>{ref.title || ""}</Text>
                      </Space>
                      <div
                        style={{
                          marginTop: "4px",
                          fontSize: "12px",
                          color: "#666",
                        }}
                      >
                        {ref.snippet || ""}
                      </div>
                    </Card>
                  ),
                )}
              </div>
            ) : null}

            <div
              style={{
                fontSize: "12px",
                color: "#999",
                marginTop: "4px",
              }}
            >
              {formatTime(message.createdAt)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const conversations = conversationsData?.data || [];
  const messages = currentConversation?.messages?.data || [];
  const [toolEventCards, setToolEventCards] = useState<
    Array<{
      toolName: string;
      args?: string;
      status: "running" | "success" | "failed";
      durationMs?: number;
      resultPreview?: string;
      error?: string;
      startedAt?: string;
    }>
  >([]);

  return (
    <div
      style={{
        height: "calc(100vh - 85px)",
        display: "flex",
        gap: "16px",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* 对话历史侧栏 */}
      <div
        style={{
          width: "280px",
          flexShrink: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <Card
          title="对话历史"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="small"
              onClick={handleNewConversation}
              loading={createConversationMutation.isPending}
            >
              {DEFAULT_CONVERSATION_TITLE}
            </Button>
          }
          variant="outlined"
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
          bodyStyle={{
            padding: "12px 0",
            flex: 1,
            minHeight: 0,
            overflow: "auto",
          }}
        >
          <Spin spinning={conversationsLoading}>
            <List
              dataSource={conversations}
              renderItem={(conv) => (
                <List.Item
                  style={{
                    padding: "8px 16px",
                    cursor: "pointer",
                    backgroundColor:
                      conv.id === currentConversationId
                        ? "#f0f8ff"
                        : "transparent",
                    borderLeft:
                      conv.id === currentConversationId
                        ? "3px solid #1890ff"
                        : "3px solid transparent",
                  }}
                  onClick={() => setCurrentConversationId(conv.id)}
                  actions={[
                    <Dropdown
                      menu={{
                        items: conversationMenuItems,
                        onClick: ({ key }) => {
                          if (key === "delete") {
                            handleDeleteConversation(conv.id);
                          } else if (key === "rename") {
                            handleRenameConversation(conv);
                          }
                        },
                      }}
                      trigger={["click"]}
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                      />
                    </Dropdown>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space size={6}>
                        <Text ellipsis>{conv.title}</Text>
                        {conv.id === streamingConversationId && (
                          <Badge status="processing" text="生成中" />
                        )}
                      </Space>
                    }
                    description={
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        {conv.lastMessageAt
                          ? new Date(conv.lastMessageAt).toLocaleString(
                              "zh-CN",
                              {
                                hour12: false,
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )
                          : ""}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          </Spin>
        </Card>
      </div>

      {/* 主对话区域 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <Card
          title={
            <Space>
              <RobotOutlined />
              {isEditingTitle ? (
                <Input
                  size="small"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={saveEditTitle}
                  onPressEnter={saveEditTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEditTitle();
                    }
                  }}
                  style={{ width: 260 }}
                  autoFocus
                />
              ) : (
                <Tooltip title="双击重命名" placement="top">
                  <span
                    onDoubleClick={beginEditTitle}
                    style={{ userSelect: "none" }}
                  >
                    {currentConvObj?.title || DEFAULT_CONVERSATION_TITLE}
                  </span>
                </Tooltip>
              )}
              <Badge status="processing" text="在线" />
              {currentConversationId && (
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() =>
                    queryClient.invalidateQueries({
                      queryKey: ["conversation", currentConversationId],
                    })
                  }
                />
              )}
            </Space>
          }
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
          bodyStyle={{
            padding: 0,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* 消息列表 */}
          <div
            ref={messagesContainerRef}
            style={{
              flex: 1,
              overflow: "auto",
              height: "100%",
              padding: "16px 24px",
              backgroundColor: "#fafafa",
            }}
          >
            {!currentConversationId ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  flexDirection: "column",
                }}
              >
                <RobotOutlined
                  style={{
                    fontSize: "48px",
                    color: "#ccc",
                    marginBottom: "16px",
                  }}
                />
                <Text type="secondary">选择一个对话或创建新对话开始聊天</Text>
              </div>
            ) : messagesLoading ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "50px",
                }}
              >
                <Spin size="large" />
              </div>
            ) : messages.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  flexDirection: "column",
                }}
              >
                <RobotOutlined
                  style={{
                    fontSize: "48px",
                    color: "#52c41a",
                    marginBottom: "16px",
                  }}
                />
                <Text>
                  你好！我是工程效能 AI 助手，面向研发、运维、技术支持场景。我可以调用工具和知识库来协助你处理问题与优化流程。
                </Text>
              </div>
            ) : (
              <>
                {messages.map(renderMessage)}

                {/* 显示待发送的用户消息 */}
                {pendingUserMessage &&
                  pendingConversationId === currentConversationId && (
                    <div style={{ marginBottom: "24px" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          flexDirection: "row-reverse",
                        }}
                      >
                        <Avatar
                          size={32}
                          icon={<UserOutlined />}
                          style={{
                            backgroundColor: "#1890ff",
                            flexShrink: 0,
                          }}
                        />
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            maxWidth: "70%",
                          }}
                        >
                          <div
                            style={{
                              background: "#1890ff",
                              color: "#fff",
                              padding: "12px 16px",
                              borderRadius: "12px",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                              marginBottom: "4px",
                              whiteSpace: "pre-wrap",
                              maxWidth: "fit-content",
                              minWidth: "20px",
                              wordBreak: "break-word",
                            }}
                          >
                            {pendingUserMessage}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#999",
                              marginTop: "4px",
                            }}
                          >
                            {formatTime(new Date().toISOString())}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* 显示流式响应中的AI消息（包括思考占位） */}
                {isStreaming &&
                  streamingConversationId === currentConversationId && (
                    <div style={{ marginBottom: "24px" }}>
                      <div style={{ display: "flex", gap: "12px" }}>
                        <Avatar
                          size={32}
                          icon={<RobotOutlined />}
                          style={{ backgroundColor: "#52c41a", flexShrink: 0 }}
                        />
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            maxWidth: "70%",
                          }}
                        >
                          {/* 规划阶段提示（新） */}
                          {planningActive && (
                            <div
                              style={{
                                background: "#fffbe6",
                                border: "1px solid #ffe58f",
                                color: "#614700",
                                padding: "8px 12px",
                                borderRadius: 8,
                                marginBottom: 8,
                                width: "100%",
                                fontSize: 12,
                              }}
                            >
                              <div style={{ marginBottom: 4 }}>
                                正在分析与选择工具…
                              </div>
                              {planningNotes.map((n, i) => (
                                <div key={i}>• {n}</div>
                              ))}
                            </div>
                          )}
                          {/* 工具调用过程（流式）——采用与历史消息相同风格 */}
                          {toolEventCards.length > 0 && (
                            <div style={{ marginTop: 8, width: "100%" }}>
                              <Collapse size="small" destroyInactivePanel>
                                {toolEventCards.map((e, idx) => {
                                  const statusColor =
                                    e.status === "success"
                                      ? "green"
                                      : e.status === "failed"
                                        ? "red"
                                        : "orange";
                                  const durationText = `${e.durationMs ?? 0} ms`;
                                  return (
                                    <Collapse.Panel
                                      key={`${e.toolName || "tool"}:${idx}`}
                                      header={
                                        <Space>
                                          <ToolOutlined />
                                          <Text strong>
                                            {e.toolName || "工具"}
                                          </Text>
                                          <Tag color={statusColor}>
                                            {e.status}
                                          </Tag>
                                          <Text type="secondary">
                                            {durationText}
                                          </Text>
                                        </Space>
                                      }
                                    >
                                      <div
                                        style={{ fontSize: 12, color: "#666" }}
                                      >
                                        <div style={{ marginBottom: 6 }}>
                                          输入参数:
                                        </div>
                                        <pre
                                          style={{
                                            background: "#f7f7f7",
                                            padding: 8,
                                            borderRadius: 6,
                                            overflow: "auto",
                                            maxHeight: 220,
                                          }}
                                        >
                                          {(() => {
                                            try {
                                              return JSON.stringify(
                                                typeof e.args === "string"
                                                  ? { input: e.args }
                                                  : e.args || {},
                                                null,
                                                2,
                                              );
                                            } catch {
                                              return String(e.args ?? "");
                                            }
                                          })()}
                                        </pre>
                                        <div
                                          style={{
                                            marginTop: 8,
                                            marginBottom: 6,
                                          }}
                                        >
                                          输出结果:
                                        </div>
                                        <pre
                                          style={{
                                            background: "#f7f7f7",
                                            padding: 8,
                                            borderRadius: 6,
                                            overflow: "auto",
                                            maxHeight: 220,
                                          }}
                                        >
                                          {e.status === "running" &&
                                          !e.resultPreview
                                            ? "执行中..."
                                            : (() => {
                                                try {
                                                  // 尝试把 resultPreview 解析为 JSON 优先渲染
                                                  const parsed = JSON.parse(
                                                    typeof e.resultPreview ===
                                                      "string"
                                                      ? e.resultPreview
                                                      : JSON.stringify(
                                                          e.resultPreview ?? {},
                                                        ),
                                                  );
                                                  return JSON.stringify(
                                                    parsed,
                                                    null,
                                                    2,
                                                  );
                                                } catch {
                                                  return typeof e.resultPreview ===
                                                    "string"
                                                    ? e.resultPreview
                                                    : JSON.stringify(
                                                        e.resultPreview ?? {},
                                                        null,
                                                        2,
                                                      );
                                                }
                                              })()}
                                        </pre>
                                        {e.status === "failed" && e.error && (
                                          <div
                                            style={{
                                              color: "#ff4d4f",
                                              marginTop: 6,
                                            }}
                                          >
                                            错误: {e.error}
                                          </div>
                                        )}
                                      </div>
                                    </Collapse.Panel>
                                  );
                                })}
                              </Collapse>
                            </div>
                          )}
                          <div
                            style={{
                              background: "#fff",
                              color: "#000",
                              padding: "12px 16px",
                              borderRadius: "12px",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                              marginBottom: "4px",
                              maxWidth: "fit-content",
                              minWidth: "20px",
                              wordBreak: "break-word",
                            }}
                          >
                            {streamingMessage ? (
                              <>
                                <MarkdownRenderer content={streamingMessage} />
                                <span
                                  style={{
                                    animation: "blink 1s infinite",
                                    marginLeft: "2px",
                                  }}
                                >
                                  |
                                </span>
                              </>
                            ) : (
                              <Space size={8}>
                                <Spin size="small" />
                                <Text type="secondary">正在思考中...</Text>
                              </Space>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#999",
                              marginTop: "4px",
                            }}
                          >
                            {streamingMessage ? "正在输入..." : "准备开始回答"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {isLoading &&
                  !isStreaming &&
                  loadingConversationId === currentConversationId && (
                    <div style={{ marginBottom: "24px" }}>
                      <div style={{ display: "flex", gap: "12px" }}>
                        <Avatar
                          size={32}
                          icon={<RobotOutlined />}
                          style={{ backgroundColor: "#52c41a" }}
                        />
                        <div
                          style={{
                            background: "#fff",
                            padding: "12px 16px",
                            borderRadius: "12px",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                          }}
                        >
                          <Spin size="small" />
                          <Text type="secondary" style={{ marginLeft: "8px" }}>
                            正在思考中...
                          </Text>
                        </div>
                      </div>
                    </div>
                  )}
              </>
            )}

            <div ref={messagesEndRef} />

            {/* CSS动画样式 */}
            <style>
              {`
                @keyframes blink {
                  0%, 50% { opacity: 1; }
                  51%, 100% { opacity: 0; }
                }
              `}
            </style>
          </div>

          <Divider style={{ margin: 0 }} />

          {/* 输入框 */}
          <div style={{ padding: "16px 24px", backgroundColor: "#fff" }}>
            <Space.Compact style={{ width: "100%" }}>
              <TextArea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="请输入您的问题（Enter发送，Shift+Enter换行）"
                autoSize={{ minRows: 1, maxRows: 4 }}
                disabled={isLoading || !currentConversationId}
                style={{ resize: "none" }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendMessage}
                loading={isLoading}
                disabled={!inputValue.trim() || !currentConversationId}
                style={{ height: "auto" }}
              >
                发送
              </Button>
            </Space.Compact>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ChatPage;
