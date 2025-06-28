#!/usr/bin/env node

import { startMcpServer } from "./src/mcp-server";

// Start the MCP server
startMcpServer().catch(console.error);
