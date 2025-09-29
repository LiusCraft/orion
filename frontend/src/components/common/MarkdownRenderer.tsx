import React from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = "markdown-content",
}) => {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { children, className, ...rest } = props;
            const match = /language-(\w+)/.exec(className || "");

            // 如果有语言标识，使用语法高亮
            if (match) {
              return (
                <SyntaxHighlighter
                  PreTag="div"
                  children={String(children).replace(/\n$/, "")}
                  language={match[1]}
                  style={vscDarkPlus}
                  customStyle={{
                    margin: "8px 0",
                    borderRadius: "6px",
                    fontSize: "13px",
                    background: "transparent",
                    padding: "12px",
                  }}
                  wrapLines={true}
                  showLineNumbers={false}
                />
              );
            }

            // 否则是行内代码
            return (
              <code
                {...rest}
                style={{
                  backgroundColor: "#f5f5f5",
                  padding: "2px 6px",
                  borderRadius: "3px",
                  fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
                  fontSize: "13px",
                  color: "#d63384",
                }}
              >
                {children}
              </code>
            );
          },
          // 自定义链接行为
          a(props) {
            const { href, children, ...rest } = props;
            return (
              <a
                {...rest}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#1890ff",
                  textDecoration: "underline",
                }}
              >
                {children}
              </a>
            );
          },
          // 自定义表格
          table(props) {
            const { children, ...rest } = props;
            return (
              <div style={{ overflowX: "auto", margin: "16px 0" }}>
                <table
                  {...rest}
                  style={{ minWidth: "100%", borderCollapse: "collapse" }}
                >
                  {children}
                </table>
              </div>
            );
          },
          th(props) {
            const { children, ...rest } = props;
            return (
              <th
                {...rest}
                style={{
                  border: "1px solid #d9d9d9",
                  padding: "8px 12px",
                  backgroundColor: "#fafafa",
                  fontWeight: 600,
                  textAlign: "left",
                }}
              >
                {children}
              </th>
            );
          },
          td(props) {
            const { children, ...rest } = props;
            return (
              <td
                {...rest}
                style={{
                  border: "1px solid #d9d9d9",
                  padding: "8px 12px",
                  textAlign: "left",
                }}
              >
                {children}
              </td>
            );
          },
          // 自定义引用块
          blockquote(props) {
            const { children, ...rest } = props;
            return (
              <blockquote
                {...rest}
                style={{
                  borderLeft: "4px solid #1890ff",
                  paddingLeft: "12px",
                  marginLeft: 0,
                  color: "#666",
                  fontStyle: "italic",
                }}
              >
                {children}
              </blockquote>
            );
          },
          // 自定义标题
          h1(props) {
            const { children, ...rest } = props;
            return (
              <h1
                {...rest}
                style={{
                  color: "#262626",
                  marginTop: "24px",
                  marginBottom: "16px",
                  fontSize: "24px",
                  fontWeight: 600,
                  lineHeight: 1.35,
                }}
              >
                {children}
              </h1>
            );
          },
          h2(props) {
            const { children, ...rest } = props;
            return (
              <h2
                {...rest}
                style={{
                  color: "#262626",
                  marginTop: "20px",
                  marginBottom: "12px",
                  fontSize: "20px",
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                {children}
              </h2>
            );
          },
          h3(props) {
            const { children, ...rest } = props;
            return (
              <h3
                {...rest}
                style={{
                  color: "#262626",
                  marginTop: "16px",
                  marginBottom: "8px",
                  fontSize: "16px",
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                {children}
              </h3>
            );
          },
          // 自定义段落
          p(props) {
            const { children, ...rest } = props;
            return (
              <p
                {...rest}
                style={{
                  lineHeight: 1.6,
                  marginBottom: "12px",
                  color: "#262626",
                }}
              >
                {children}
              </p>
            );
          },
          // 自定义列表
          ul(props) {
            const { children, ...rest } = props;
            return (
              <ul
                {...rest}
                style={{
                  paddingLeft: "24px",
                  marginBottom: "12px",
                }}
              >
                {children}
              </ul>
            );
          },
          ol(props) {
            const { children, ...rest } = props;
            return (
              <ol
                {...rest}
                style={{
                  paddingLeft: "24px",
                  marginBottom: "12px",
                }}
              >
                {children}
              </ol>
            );
          },
          li(props) {
            const { children, ...rest } = props;
            return (
              <li
                {...rest}
                style={{
                  marginBottom: "4px",
                  lineHeight: 1.6,
                }}
              >
                {children}
              </li>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
