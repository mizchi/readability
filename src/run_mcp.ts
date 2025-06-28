#!/usr/bin/env node

// Entry point for DXT CLI
import { startMcpServer } from "./mcp-server.js";

startMcpServer().catch(console.error);