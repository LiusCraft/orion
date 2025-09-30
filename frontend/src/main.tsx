import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import { StyleProvider } from "@ant-design/cssinjs";
import "antd/dist/reset.css";
import zhCN from "antd/locale/zh_CN";
import App from "./App.tsx";
import "./index.css";
import "./styles/markdown.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5分钟
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <StyleProvider hashPriority="high">
        <ConfigProvider locale={zhCN}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ConfigProvider>
      </StyleProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
