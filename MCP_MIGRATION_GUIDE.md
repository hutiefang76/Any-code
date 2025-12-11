# MCP 前端组件迁移指南

本文档说明如何将前端 MCP 组件从旧版（依赖 CLI）迁移到新版（直接操作配置文件，支持多应用）。

## 📋 迁移概览

### 已完成
- ✅ 后端完整重构（参考 cc-switch 架构）
- ✅ `src/lib/api.ts` 类型定义和新方法

### 待迁移组件
1. `MCPManager.tsx` - 主管理组件
2. `MCPAddServer.tsx` - 添加服务器组件
3. `MCPServerList.tsx` - 服务器列表组件
4. `MCPImportExport.tsx` - 导入导出组件

---

## 🔄 API 映射对照表

### 旧版 API → 新版 API

| 旧版方法 | 新版方法 | 说明 |
|---------|---------|------|
| `api.mcpList()` | `api.mcpGetAllServers()` | 返回 `Record<string, MCPServerSpec>` |
| `api.mcpAdd()` | `api.mcpUpsertServer()` | 支持多应用，需传递 `apps` 参数 |
| `api.mcpRemove()` | `api.mcpDeleteServer()` | 需传递 `apps` 参数 |
| - | `api.mcpToggleApp()` | 新增：切换应用启用状态 |
| `api.mcpAddFromClaudeDesktop()` | `api.mcpImportFromApp("claude")` | 统一导入接口 |
| - | `api.mcpGetStatus()` | 新增：获取 MCP 状态 |
| - | `api.mcpValidateCommand()` | 新增：验证命令可用性 |

---

## 📝 组件迁移示例

### 1. MCPManager.tsx

**旧版：**
```typescript
const loadServers = async (forceRefresh = false) => {
  const result = await api.mcpList();
  setServers(result);
};
```

**新版：**
```typescript
const loadServers = async (forceRefresh = false) => {
  const serversMap = await api.mcpGetAllServers();

  // 转换为数组格式（包含 ID）
  const serversList = Object.entries(serversMap).map(([id, spec]) => ({
    id,
    name: id, // 或从 spec 中提取
    server: spec,
    apps: {
      claude: true,  // 需要根据实际情况获取
      codex: false,
      gemini: false,
    }
  }));

  setServers(serversList);
};
```

---

### 2. MCPAddServer.tsx

**旧版：**
```typescript
const result = await api.mcpAdd(
  stdioName,
  "stdio",
  stdioCommand,
  args,
  env,
  undefined,
  stdioScope
);
```

**新版：**
```typescript
const serverSpec: MCPServerSpec = {
  type: "stdio",
  command: stdioCommand,
  args: args,
  env: env,
};

const apps: McpApps = {
  claude: true,  // 默认启用 Claude
  codex: false,
  gemini: false,
};

const result = await api.mcpUpsertServer(
  stdioName,  // id
  stdioName,  // name
  serverSpec,
  apps
);
```

**新增功能：应用选择器**
```typescript
<div className="space-y-2">
  <Label>启用应用</Label>
  <div className="flex gap-4">
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={apps.claude}
             onChange={(e) => setApps({...apps, claude: e.target.checked})} />
      Claude
    </label>
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={apps.codex}
             onChange={(e) => setApps({...apps, codex: e.target.checked})} />
      Codex
    </label>
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={apps.gemini}
             onChange={(e) => setApps({...apps, gemini: e.target.checked})} />
      Gemini
    </label>
  </div>
</div>
```

---

### 3. MCPServerList.tsx

**新增功能：应用状态显示和切换**

```typescript
interface ServerItemProps {
  server: McpServer;  // 使用新类型
  onToggleApp: (id: string, app: string, enabled: boolean) => void;
}

const ServerItem: React.FC<ServerItemProps> = ({ server, onToggleApp }) => {
  return (
    <div>
      <h3>{server.name}</h3>

      {/* 应用状态显示 */}
      <div className="flex gap-2 mt-2">
        <Badge
          variant={server.apps.claude ? "default" : "outline"}
          onClick={() => onToggleApp(server.id, "claude", !server.apps.claude)}
          className="cursor-pointer"
        >
          Claude {server.apps.claude ? "✓" : "✗"}
        </Badge>
        <Badge
          variant={server.apps.codex ? "default" : "outline"}
          onClick={() => onToggleApp(server.id, "codex", !server.apps.codex)}
          className="cursor-pointer"
        >
          Codex {server.apps.codex ? "✓" : "✗"}
        </Badge>
        <Badge
          variant={server.apps.gemini ? "default" : "outline"}
          onClick={() => onToggleApp(server.id, "gemini", !server.apps.gemini)}
          className="cursor-pointer"
        >
          Gemini {server.apps.gemini ? "✓" : "✗"}
        </Badge>
      </div>
    </div>
  );
};

// 在父组件中处理切换
const handleToggleApp = async (id: string, app: string, enabled: boolean) => {
  try {
    const server = servers.find(s => s.id === id);
    if (!server) return;

    await api.mcpToggleApp(id, server.server, app, enabled);

    // 更新本地状态
    setServers(servers.map(s =>
      s.id === id
        ? { ...s, apps: { ...s.apps, [app]: enabled } }
        : s
    ));
  } catch (error) {
    console.error("Failed to toggle app:", error);
  }
};
```

---

### 4. MCPImportExport.tsx

**旧版：**
```typescript
const result = await api.mcpAddFromClaudeDesktop(importScope);
```

**新版：**
```typescript
// 导入时需要先获取服务器列表，然后逐个添加
const importFromClaude = async () => {
  try {
    const serverIds = await api.mcpImportFromApp("claude");

    // 获取详细配置
    const serversMap = await api.mcpGetAllServers();

    let imported = 0;
    for (const id of serverIds) {
      const spec = serversMap[id];
      if (spec) {
        await api.mcpUpsertServer(id, id, spec, {
          claude: true,
          codex: false,
          gemini: false,
        });
        imported++;
      }
    }

    onImportCompleted(imported, serverIds.length - imported);
  } catch (error) {
    console.error("Import failed:", error);
    onError("导入失败");
  }
};
```

---

## 🎨 UI 改进建议

### 1. 服务器卡片增强

在服务器列表中添加多应用状态指示：

```typescript
<Card>
  <CardHeader>
    <CardTitle>{server.name}</CardTitle>
    <div className="flex gap-1 mt-2">
      {server.apps.claude && <Badge>Claude</Badge>}
      {server.apps.codex && <Badge>Codex</Badge>}
      {server.apps.gemini && <Badge>Gemini</Badge>}
    </div>
  </CardHeader>
  <CardContent>
    {/* 服务器详情 */}
  </CardContent>
</Card>
```

### 2. 应用快速切换

添加工具栏快捷操作：

```typescript
<div className="flex gap-2">
  <Button variant="outline" size="sm" onClick={() => toggleAllApps("claude")}>
    全部启用 Claude
  </Button>
  <Button variant="outline" size="sm" onClick={() => toggleAllApps("codex")}>
    全部启用 Codex
  </Button>
  <Button variant="outline" size="sm" onClick={() => toggleAllApps("gemini")}>
    全部启用 Gemini
  </Button>
</div>
```

---

## ⚠️ 迁移注意事项

1. **数据格式变化**
   - 旧版返回 `MCPServer[]`（包含 transport, scope 等）
   - 新版返回 `Record<string, MCPServerSpec>`（只包含实际配置）
   - 需要适配数据结构

2. **作用域移除**
   - 旧版有 `scope: "local" | "project" | "user"`
   - 新版直接操作配置文件，无需 scope 概念

3. **传输类型统一**
   - 旧版使用 `transport: "stdio" | "sse"`
   - 新版使用 `type: "stdio" | "http" | "sse"`（增加 http）

4. **命令验证**
   - 新增 `api.mcpValidateCommand()` 用于在添加前验证命令可用性
   - 建议在表单中实时验证

---

## 🧹 清理旧代码

迁移完成后，可以删除以下旧版API（标记为 `@deprecated`）：

```typescript
// src/lib/api.ts 中可删除
- MCPServer 接口（旧版）
- ServerStatus 接口
- api.mcpAdd()
- api.mcpList()
- api.mcpGet()
- api.mcpRemove()
- api.mcpAddJson()
- api.mcpAddFromClaudeDesktop()
- api.mcpTestConnection()
- api.mcpExportConfig()
```

**后端可删除的命令：**
```rust
// src-tauri/src/commands/mcp.rs
- mcp_add
- mcp_list
- mcp_get
- mcp_remove
- mcp_add_json
- mcp_add_from_claude_desktop
- mcp_test_connection
- mcp_export_config
- mcp_get_server_status
```

---

## ✅ 迁移检查清单

- [ ] MCPManager 组件已迁移
- [ ] MCPAddServer 组件已迁移
- [ ] MCPServerList 组件已迁移
- [ ] MCPImportExport 组件已迁移
- [ ] 添加应用选择器 UI
- [ ] 添加应用状态显示
- [ ] 测试多应用切换功能
- [ ] 测试导入导出功能
- [ ] 删除旧版 API 调用
- [ ] 删除后端废弃命令
- [ ] 更新相关文档

---

## 🚀 测试建议

1. **基本功能测试**
   - 添加 stdio 服务器
   - 添加 SSE 服务器
   - 删除服务器
   - 切换应用启用状态

2. **多应用测试**
   - 同一服务器在不同应用间切换
   - 批量启用/禁用
   - 验证配置文件正确写入

3. **导入导出测试**
   - 从 Claude 导入
   - 从 Codex 导入（如果可用）
   - 从 Gemini 导入（如果可用）
   - 导出配置验证

---

**迁移完成后，您的 MCP 管理功能将支持：**
- ✅ Claude、Codex、Gemini 三应用统一管理
- ✅ 直接操作配置文件，无需 CLI 依赖
- ✅ 原子写入，数据安全
- ✅ 完整的配置验证
- ✅ 更好的性能和稳定性
