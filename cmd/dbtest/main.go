package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

func main() {
	// 尝试不同的连接字符串格式
	connStrings := []string{
		// 基本连接
		"host=124.220.234.136 port=5432 user=sreagent password=zXLWyBy2h7jYfKJK dbname=sreagent sslmode=disable",

		// 尝试指定认证方法
		"postgresql://sreagent:zXLWyBy2h7jYfKJK@124.220.234.136:5432/sreagent?sslmode=disable",

		// 尝试不同的SSL模式
		"host=124.220.234.136 port=5432 user=sreagent password=zXLWyBy2h7jYfKJK dbname=sreagent sslmode=prefer",

		// 尝试允许SSL模式
		"host=124.220.234.136 port=5432 user=sreagent password=zXLWyBy2h7jYfKJK dbname=sreagent sslmode=allow",
	}

	for i, connStr := range connStrings {
		fmt.Printf("尝试连接方式 %d: %s\n", i+1, connStr)

		db, err := sql.Open("postgres", connStr)
		if err != nil {
			log.Printf("打开连接失败: %v\n", err)
			continue
		}
		defer db.Close()

		err = db.Ping()
		if err != nil {
			log.Printf("连接测试失败: %v\n", err)
		} else {
			fmt.Printf("✅ 连接成功！使用连接字符串: %s\n", connStr)

			// 测试查询
			var version string
			err = db.QueryRow("SELECT version()").Scan(&version)
			if err != nil {
				log.Printf("查询失败: %v\n", err)
			} else {
				fmt.Printf("PostgreSQL版本: %s\n", version)
			}
			break
		}
		fmt.Println("---")
	}
}
