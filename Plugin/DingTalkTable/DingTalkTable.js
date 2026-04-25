#!/usr/bin/env node
/**
 * DingTalkTable - 钉钉 AI 表格写入插件
 *
 * 功能：
 * 1. 通过 MCP 协议调用钉钉 AI 表格 API
 * 2. 支持写入日报、周报
 * 3. 支持列出可用表格
 * 4. 支持直接调用底层 MCP 工具
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// ============ 配置 ============

const CONFIG = {
  MCP_URL: process.env.DINGTALK_MCP_URL || 'http://127.0.0.1:9000',
  MCP_KEY: process.env.DINGTALK_MCP_KEY || 'vcp-mcpo-secret',
  TABLE_UUID: process.env.DINGTALK_TABLE_UUID || '',
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || 'Asia/Shanghai',
};

// ============ MCP 客户端 ============

class MCPClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * 发送 HTTP 请求到 MCP 服务器
   */
  async request(method, endpoint, data = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const body = JSON.stringify(data);

    return new Promise((resolve, reject) => {
      const req = http.request(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(result);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${result.error || responseData}`));
            }
          } catch (e) {
            reject(new Error(`解析响应失败：${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  /**
   * 列出所有可用的 MCP 工具
   */
  async listTools() {
    return this.request('GET', '/tools/');
  }

  /**
   * 调用 MCP 工具
   */
  async callTool(toolName, args = {}) {
    return this.request('POST', `/tools/${toolName}/invoke`, args);
  }

  /**
   * 获取工具信息
   */
  async getToolInfo(toolName) {
    return this.request('GET', `/tools/${toolName}/`);
  }
}

// ============ 钉钉表格操作 ============

class DingTalkTableClient {
  constructor(mcpClient, tableUuid) {
    this.mcpClient = mcpClient;
    this.tableUuid = tableUuid;
  }

  /**
   * 列出所有可用的表格
   */
  async listTables() {
    try {
      const tools = await this.mcpClient.listTools();
      return {
        status: 'success',
        result: {
          message: '可用表格列表需要从 MCP 服务器获取',
          tools: tools,
          note: '钉钉 AI 表格通过 MCP 工具暴露，请查看可用的 MCP 工具列表'
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: `获取表格列表失败：${error.message}`
      };
    }
  }

  /**
   * 写入日报
   */
  async writeDailyReport(content, reportDate, maid = 'AI') {
    try {
      // 尝试调用钉钉 AI 表格的 MCP 工具
      const result = await this.mcpClient.callTool('add_record', {
        table_uuid: this.tableUuid,
        data: {
          '日期': reportDate,
          '工作内容': content,
          '记录人': maid,
          '类型': '日报'
        }
      });

      return {
        status: 'success',
        result: {
          message: '日报已成功写入钉钉 AI 表格',
          recordId: result.id,
          date: reportDate
        }
      };
    } catch (error) {
      // 如果 MCP 调用失败，返回错误信息
      return {
        status: 'error',
        error: `写入日报失败：${error.message}`
      };
    }
  }

  /**
   * 写入周报
   */
  async writeWeeklyReport(content, weekStart, summary = '', maid = 'AI') {
    try {
      const result = await this.mcpClient.callTool('add_record', {
        table_uuid: this.tableUuid,
        data: {
          '周开始日期': weekStart,
          '周报摘要': summary,
          '详细内容': content,
          '记录人': maid,
          '类型': '周报'
        }
      });

      return {
        status: 'success',
        result: {
          message: '周报已成功写入钉钉 AI 表格',
          recordId: result.id,
          weekStart: weekStart
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: `写入周报失败：${error.message}`
      };
    }
  }
}

// ============ 主处理逻辑 ============

async function handleRequest(request) {
  const { action, tool_name, table_uuid, report_date, week_start, content, summary, maid, arguments: args } = request;

  // 创建 MCP 客户端
  const mcpClient = new MCPClient(CONFIG.MCP_URL, CONFIG.MCP_KEY);
  const tableClient = new DingTalkTableClient(mcpClient, table_uuid || CONFIG.TABLE_UUID);

  switch (action) {
    case 'list_tables':
      return await tableClient.listTables();

    case 'write_daily_report':
      if (!content) {
        return { status: 'error', error: '缺少必需参数：content（日报内容）' };
      }
      const date = reportDate || new Date().toISOString().split('T')[0];
      return await tableClient.writeDailyReport(content, date, maid || 'AI');

    case 'write_weekly_report':
      if (!content) {
        return { status: 'error', error: '缺少必需参数：content（周报内容）' };
      }
      const weekStart = weekStart || getWeekStart(new Date()).toISOString().split('T')[0];
      return await tableClient.writeWeeklyReport(content, weekStart, summary || '', maid || 'AI');

    case 'call_mcp_tool':
      if (!tool_name) {
        return { status: 'error', error: '缺少必需参数：tool_name（MCP 工具名称）' };
      }
      try {
        const result = await mcpClient.callTool(tool_name, args || {});
        return {
          status: 'success',
          result: result
        };
      } catch (error) {
        return {
          status: 'error',
          error: `MCP 工具调用失败：${error.message}`
        };
      }

    default:
      return { status: 'error', error: `未知操作：${action}` };
  }
}

// 获取本周开始日期（周一）
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// ============ 主函数 ============

async function main() {
  let inputData = '';

  process.stdin.on('data', chunk => {
    inputData += chunk;
  });

  process.stdin.on('end', async () => {
    try {
      if (!inputData.trim()) {
        console.log(JSON.stringify({
          status: 'error',
          error: '无输入数据'
        }));
        process.exit(0);
      }

      const request = JSON.parse(inputData);
      const response = await handleRequest(request);
      console.log(JSON.stringify(response));
    } catch (e) {
      console.log(JSON.stringify({
        status: 'error',
        error: `处理请求失败：${e.message}`
      }));
    }

    process.exit(0);
  });
}

main();
