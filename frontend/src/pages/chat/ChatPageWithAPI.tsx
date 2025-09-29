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
} from "antd";
import {
  SendOutlined,
  UserOutlined,
  RobotOutlined,
  PlusOutlined,
  MoreOutlined,
  DeleteOutlined,
  BookOutlined,
  ToolOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatService } from "../../services/chatService";
import type { Message as MessageType } from "../../types";
import MarkdownRenderer from "../../components/common/MarkdownRenderer";

const { TextArea } = Input;
const { Text } = Typography;

interface ToolCall {
  name: string;
  description: string;
  result?: string;
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
  const [pendingUserMessage, setPendingUserMessage] = useState<string>("");

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

      // 立即开始AI流式响应
      startAIStreaming(data.conversationId);

      return userMessage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["conversation", currentConversationId],
      });
      setPendingUserMessage("");
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (currentConversationId === currentConversationId) {
        setCurrentConversationId(null);
      }
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
  const startAIStreaming = (conversationId: string) => {
    setIsStreaming(true);
    setStreamingMessage("");

    // 清理之前的连接
    if (sseConnection) {
      sseConnection.close();
    }

    // 创建新的SSE连接
    const eventSource = chatService.createChatStream(conversationId);
    setSseConnection(eventSource);

    // 监听特定类型的事件
    eventSource.addEventListener("message_start", (event: MessageEvent) => {
      try {
        const eventData = JSON.parse(event.data);
        console.log("AI开始响应:", eventData.data);
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
        setStreamingMessage("");
        // 刷新消息列表以显示完整的AI回复
        queryClient.invalidateQueries({
          queryKey: ["conversation", conversationId],
        });
      } catch (error) {
        console.error("解析message_complete事件失败:", error);
      }
    });

    eventSource.addEventListener("error", (event: MessageEvent) => {
      try {
        const eventData = JSON.parse(event.data);
        console.error("AI响应错误:", eventData.data);
        setIsStreaming(false);
        setStreamingMessage("");
        message.error(`AI响应错误: ${eventData.data.error}`);
      } catch (error) {
        console.error("解析error事件失败:", error);
      }
    });

    // 通用错误处理
    eventSource.onerror = (error) => {
      console.error("SSE连接错误:", error);
      setIsStreaming(false);
      setStreamingMessage("");
      eventSource.close();
      setSseConnection(null);
    };

    // 监听done事件
    eventSource.addEventListener("done", () => {
      setIsStreaming(false);
      setStreamingMessage("");
      eventSource.close();
      setSseConnection(null);
    });
  };

  useEffect(() => {
    // 流式消息变化时：只在用户在底部时才跟随滚动
    if (streamingMessage && isStreaming) {
      smartScroll();
    }
  }, [streamingMessage, isStreaming, smartScroll]);

  // 初次加载消息数据时强制滚动到底部
  useEffect(() => {
    if (currentConversation?.messages?.data && !isStreaming) {
      scrollToBottom();
    }
  }, [currentConversation?.messages?.data, isStreaming]);

  // 用户发送的消息显示时强制滚动到底部
  useEffect(() => {
    if (pendingUserMessage) {
      scrollToBottom();
    }
  }, [pendingUserMessage]);

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

    // 立即显示用户消息
    setPendingUserMessage(messageContent);
    setInputValue("");

    try {
      await sendMessageMutation.mutateAsync({
        conversationId: currentConversationId,
        content: messageContent,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    createConversationMutation.mutate("新对话");
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
      key: "delete",
      icon: <DeleteOutlined />,
      label: "删除对话",
      danger: true,
    },
  ];

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

            {/* 工具调用结果 - 从 metadata 中解析 */}
            {message.metadata?.tools &&
            Array.isArray(message.metadata.tools) ? (
              <div style={{ marginTop: "8px" }}>
                {(message.metadata.tools as ToolCall[]).map(
                  (tool: ToolCall, index: number) => (
                    <Card
                      key={index}
                      size="small"
                      style={{ marginBottom: "8px" }}
                    >
                      <Space>
                        <ToolOutlined />
                        <Text strong>{tool.description || ""}</Text>
                      </Space>
                      {tool.result && (
                        <div
                          style={{
                            marginTop: "8px",
                            fontSize: "12px",
                            color: "#666",
                          }}
                        >
                          {String(tool.result)}
                        </div>
                      )}
                    </Card>
                  ),
                )}
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

  return (
    <div
      style={{ height: "calc(100vh - 112px)", display: "flex", gap: "16px" }}
    >
      {/* 对话历史侧栏 */}
      <div style={{ width: "280px", flexShrink: 0 }}>
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
              新对话
            </Button>
          }
          style={{ height: "100%" }}
          bodyStyle={{
            padding: "12px 0",
            height: "calc(100% - 57px)",
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
                        onClick: () => handleDeleteConversation(conv.id),
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
                    title={<Text ellipsis>{conv.title}</Text>}
                    description={
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        {conv.lastMessageAt
                          ? new Date(conv.lastMessageAt).toLocaleDateString(
                              "zh-CN",
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
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Card
          title={
            <Space>
              <RobotOutlined />
              <span>CDN AI Agent</span>
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
          style={{ height: "100%" }}
          bodyStyle={{
            padding: 0,
            height: "calc(100% - 57px)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* 消息列表 */}
          <div
            ref={messagesContainerRef}
            style={{
              flex: 1,
              overflow: "auto",
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
                  你好！我是CDN AI
                  Agent，专门帮助解决CDN相关的技术问题。请问有什么可以帮助您的吗？
                </Text>
              </div>
            ) : (
              <>
                {messages.map(renderMessage)}

                {/* 显示待发送的用户消息 */}
                {pendingUserMessage && (
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

                {/* 显示流式响应中的AI消息 */}
                {isStreaming && streamingMessage && (
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
                          <MarkdownRenderer content={streamingMessage} />
                          <span
                            style={{
                              animation: "blink 1s infinite",
                              marginLeft: "2px",
                            }}
                          >
                            |
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#999",
                            marginTop: "4px",
                          }}
                        >
                          正在输入...
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isLoading && !isStreaming && (
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
