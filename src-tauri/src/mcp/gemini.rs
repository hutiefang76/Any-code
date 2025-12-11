//! Gemini MCP 同步和导入模块

use serde_json::Value;
use std::collections::HashMap;

use super::validation::validate_server_spec;

/// 将单个 MCP 服务器同步到 Gemini 配置
pub fn sync_single_server_to_gemini(id: &str, server_spec: &Value) -> Result<(), String> {
    let current = crate::gemini_mcp::read_mcp_servers_map()?;
    let mut updated = current;
    updated.insert(id.to_string(), server_spec.clone());
    crate::gemini_mcp::set_mcp_servers_map(&updated)
}

/// 从 Gemini 配置中移除单个 MCP 服务器
pub fn remove_server_from_gemini(id: &str) -> Result<(), String> {
    let mut current = crate::gemini_mcp::read_mcp_servers_map()?;
    current.remove(id);
    crate::gemini_mcp::set_mcp_servers_map(&current)
}

/// 从 Gemini 导入 MCP 服务器
pub fn import_from_gemini() -> Result<HashMap<String, Value>, String> {
    let servers = crate::gemini_mcp::read_mcp_servers_map()?;

    let mut result = HashMap::new();
    let mut errors = Vec::new();

    for (id, spec) in servers.iter() {
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

/// 将多个服务器同步到 Gemini
pub fn sync_servers_to_gemini(servers: &HashMap<String, Value>) -> Result<(), String> {
    crate::gemini_mcp::set_mcp_servers_map(servers)
}
