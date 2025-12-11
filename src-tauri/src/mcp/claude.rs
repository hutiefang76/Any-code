//! Claude MCP 同步和导入模块

use serde_json::Value;
use std::collections::HashMap;

use super::validation::validate_server_spec;

/// 将单个 MCP 服务器同步到 Claude live 配置
pub fn sync_single_server_to_claude(id: &str, server_spec: &Value) -> Result<(), String> {
    // 读取现有的 MCP 配置
    let current = crate::claude_mcp::read_mcp_servers_map()?;

    // 创建新的 HashMap，包含现有的所有服务器 + 当前要同步的服务器
    let mut updated = current;
    updated.insert(id.to_string(), server_spec.clone());

    // 写回
    crate::claude_mcp::set_mcp_servers_map(&updated)
}

/// 从 Claude live 配置中移除单个 MCP 服务器
pub fn remove_server_from_claude(id: &str) -> Result<(), String> {
    // 读取现有的 MCP 配置
    let mut current = crate::claude_mcp::read_mcp_servers_map()?;

    // 移除指定服务器
    current.remove(id);

    // 写回
    crate::claude_mcp::set_mcp_servers_map(&current)
}

/// 从 ~/.claude.json 导入 mcpServers
pub fn import_from_claude() -> Result<HashMap<String, Value>, String> {
    let text_opt = crate::claude_mcp::read_mcp_json()?;
    let Some(text) = text_opt else {
        return Ok(HashMap::new());
    };

    let v: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析 ~/.claude.json 失败: {}", e))?;

    let Some(map) = v.get("mcpServers").and_then(|x| x.as_object()) else {
        return Ok(HashMap::new());
    };

    let mut result = HashMap::new();
    let mut errors = Vec::new();

    for (id, spec) in map.iter() {
        // 校验：单项失败不中止，收集错误继续处理
        if let Err(e) = validate_server_spec(spec) {
            log::warn!("跳过无效 MCP 服务器 '{}': {}", id, e);
            errors.push(format!("{}: {}", id, e));
            continue;
        }

        result.insert(id.clone(), spec.clone());
    }

    if !errors.is_empty() {
        log::warn!("导入完成，但有 {} 项失败: {:?}", errors.len(), errors);
    }

    Ok(result)
}

/// 将多个服务器同步到 Claude
pub fn sync_servers_to_claude(servers: &HashMap<String, Value>) -> Result<(), String> {
    crate::claude_mcp::set_mcp_servers_map(servers)
}
