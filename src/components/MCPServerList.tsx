import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Network,
  Globe,
  Terminal,
  Trash2,
  Play,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type McpServer } from "@/lib/api";
import { copyTextToClipboard } from "@/lib/clipboard";
import { MCPServerListSkeleton } from "@/components/skeletons/MCPServerListSkeleton";

interface MCPServerListProps {
  /**
   * List of MCP servers to display
   */
  servers: McpServer[];
  /**
   * Whether the list is loading
   */
  loading: boolean;
  /**
   * Callback when a server is removed
   */
  onServerRemoved: (id: string) => void;
  /**
   * Callback to refresh the server list
   */
  onRefresh: () => void;
}

/**
 * Component for displaying a list of MCP servers
 * Shows servers grouped by scope with status indicators
 */
export const MCPServerList: React.FC<MCPServerListProps> = ({
  servers,
  loading,
  onServerRemoved,
  onRefresh,
}) => {
  const [removingServer, setRemovingServer] = useState<string | null>(null);
  const [testingServer, setTestingServer] = useState<string | null>(null);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [copiedServer, setCopiedServer] = useState<string | null>(null);

  /**
   * Toggles expanded state for a server
   */
  const toggleExpanded = (serverId: string) => {
    setExpandedServers(prev => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  };

  /**
   * Copies command to clipboard
   */
  const copyCommand = async (command: string, serverId: string) => {
    try {
      await copyTextToClipboard(command);
      setCopiedServer(serverId);
      setTimeout(() => setCopiedServer(null), 2000);
    } catch (error) {
      console.error("Failed to copy command:", error);
    }
  };

  /**
   * Removes a server
   */
  const handleRemoveServer = async (server: McpServer) => {
    try {
      setRemovingServer(server.id);
      // 使用新的 API 删除服务器
      await api.mcpDeleteServer(server.id, server.apps);
      onServerRemoved(server.id);
    } catch (error) {
      console.error("Failed to remove server:", error);
    } finally {
      setRemovingServer(null);
    }
  };

  /**
   * Tests connection to a server
   */
  const handleTestConnection = async (name: string) => {
    try {
      setTestingServer(name);
      const result = await api.mcpTestConnection(name);
      // TODO: Show result in a toast or modal
      console.log("Test result:", result);
    } catch (error) {
      console.error("Failed to test connection:", error);
    } finally {
      setTestingServer(null);
    }
  };

  /**
   * Gets icon for transport type
   */
  const getTransportIcon = (transport: string) => {
    switch (transport) {
      case "stdio":
        return <Terminal className="h-4 w-4 text-amber-500" />;
      case "sse":
        return <Globe className="h-4 w-4 text-emerald-500" />;
      default:
        return <Network className="h-4 w-4 text-blue-500" />;
    }
  };

  /**
   * 切换应用启用状态（新增）
   */
  const handleToggleApp = async (server: McpServer, app: string, enabled: boolean) => {
    try {
      await api.mcpToggleApp(server.id, server.server, app, enabled);
      // 刷新列表
      onRefresh();
    } catch (error) {
      console.error("Failed to toggle app:", error);
    }
  };

  /**
   * Renders a single server item
   */
  const renderServerItem = (server: McpServer) => {
    const isExpanded = expandedServers.has(server.id);
    const isCopied = copiedServer === server.id;
    
    // 获取传输类型
    const transport = server.server.type || "stdio";
    const command = server.server.command;
    const url = server.server.url;

    return (
      <motion.div
        key={server.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="group p-4 rounded-lg border border-border bg-card hover:bg-accent/5 hover:border-primary/20 transition-all overflow-hidden"
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded">
                  {getTransportIcon(transport)}
                </div>
                <h4 className="font-medium truncate">{server.name}</h4>

                {/* 应用状态 badges（新增） */}
                <div className="flex gap-1 ml-auto">
                  {server.apps.claude && (
                    <Badge
                      variant="outline"
                      className="gap-1 flex-shrink-0 border-blue-500/50 text-blue-600 bg-blue-500/10 cursor-pointer hover:bg-blue-500/20"
                      onClick={() => handleToggleApp(server, "claude", false)}
                      title="点击禁用 Claude"
                    >
                      Claude ✓
                    </Badge>
                  )}
                  {server.apps.codex && (
                    <Badge
                      variant="outline"
                      className="gap-1 flex-shrink-0 border-purple-500/50 text-purple-600 bg-purple-500/10 cursor-pointer hover:bg-purple-500/20"
                      onClick={() => handleToggleApp(server, "codex", false)}
                      title="点击禁用 Codex"
                    >
                      Codex ✓
                    </Badge>
                  )}
                  {server.apps.gemini && (
                    <Badge
                      variant="outline"
                      className="gap-1 flex-shrink-0 border-green-500/50 text-green-600 bg-green-500/10 cursor-pointer hover:bg-green-500/20"
                      onClick={() => handleToggleApp(server, "gemini", false)}
                      title="点击禁用 Gemini"
                    >
                      Gemini ✓
                    </Badge>
                  )}
                </div>
              </div>
              
              {command && !isExpanded && (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground font-mono truncate pl-9 flex-1" title={command}>
                    {command}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(server.id)}
                    className="h-6 px-2 text-xs hover:bg-primary/10"
                  >
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Show full
                  </Button>
                </div>
              )}

              {transport === "sse" && url && !isExpanded && (
                <div className="overflow-hidden">
                  <p className="text-xs text-muted-foreground font-mono truncate pl-9" title={url}>
                    {url}
                  </p>
                </div>
              )}

              {server.server.env && Object.keys(server.server.env).length > 0 && !isExpanded && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground pl-9">
                  <span>Environment variables: {Object.keys(server.server.env).length}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleTestConnection(server.id)}
                disabled={testingServer === server.id}
                className="hover:bg-green-500/10 hover:text-green-600"
                title="Test Connection"
              >
                {testingServer === server.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveServer(server)}
                disabled={removingServer === server.id}
                className="hover:bg-destructive/10 hover:text-destructive"
                title="Delete Server"
              >
                {removingServer === server.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          {/* Expanded Details */}
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="pl-9 space-y-3 pt-2 border-t border-border/50"
            >
              {command && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Command</p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCommand(command, server.id)}
                        className="h-6 px-2 text-xs hover:bg-primary/10"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        {isCopied ? "Copied!" : "Copy"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(server.id)}
                        className="h-6 px-2 text-xs hover:bg-primary/10"
                      >
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Hide
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs font-mono bg-muted/50 p-2 rounded break-all">
                    {command}
                  </p>
                </div>
              )}

              {server.server.args && server.server.args.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Arguments</p>
                  <div className="text-xs font-mono bg-muted/50 p-2 rounded space-y-1">
                    {server.server.args.map((arg, idx) => (
                      <div key={idx} className="break-all">
                        <span className="text-muted-foreground mr-2">[{idx}]</span>
                        {arg}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {transport === "sse" && url && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">URL</p>
                  <p className="text-xs font-mono bg-muted/50 p-2 rounded break-all">
                    {url}
                  </p>
                </div>
              )}

              {server.server.env && Object.keys(server.server.env).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Environment Variables</p>
                  <div className="text-xs font-mono bg-muted/50 p-2 rounded space-y-1">
                    {Object.entries(server.server.env).map(([key, value]) => (
                      <div key={key} className="break-all">
                        <span className="text-primary">{key}</span>
                        <span className="text-muted-foreground mx-1">=</span>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return <MCPServerListSkeleton />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold">Configured Servers</h3>
          <p className="text-sm text-muted-foreground">
            {servers.length} server{servers.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary/50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Server List */}
      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-primary/10 rounded-full mb-4">
            <Network className="h-12 w-12 text-primary" />
          </div>
          <p className="text-muted-foreground mb-2 font-medium">No MCP servers configured</p>
          <p className="text-sm text-muted-foreground">
            Add a server to get started with Model Context Protocol
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {servers.map((server) => renderServerItem(server))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}; 
