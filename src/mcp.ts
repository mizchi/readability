#!/usr/bin/env node

import { startMcpServer } from "./mcp-server.js";

// Start the MCP server
startMcpServer().catch(console.error);
