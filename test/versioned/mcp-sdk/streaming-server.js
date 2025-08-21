/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const express = require('express')
const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js')
const { z } = require('zod')

const server = new McpServer({
  name: 'test-server',
  version: '1.0.0',
  capabilities: {
    resources: {},
    tools: {},
    prompts: {}
  },
})

const transport = new StreamableHTTPServerTransport({
  // Session management isn't needed for this test
  sessionIdGenerator: undefined,

  // We are running this server locally, so enable DNS rebinding protection
  enableDnsRebindingProtection: true,
  allowedHosts: ['127.0.0.1:3000', 'localhost:3000'],
})

// Set up server resources, tools, and prompts
server.registerResource(
  'echo',
  new ResourceTemplate('echo://{message}', { list: undefined }),
  {
    title: 'Echo Resource',
    description: 'Echoes back messages as resources'
  },
  async (uri, { message }) => {
    const result = {
      contents: [{
        uri: uri.href,
        text: `Resource echo: ${message}`
      }]
    }
    return result
  }
)

server.registerTool(
  'echo',
  {
    title: 'Echo Tool',
    description: 'Echoes back the provided message',
    inputSchema: { message: z.string() }
  },
  async ({ message }) => {
    const result = { content: [{ type: 'text', text: `Tool echo: ${message}` }] }
    return result
  }
)

server.registerPrompt(
  'echo',
  {
    title: 'Echo Prompt',
    description: 'Creates a prompt to process a message',
    argsSchema: { message: z.string() }
  },
  ({ message }) => {
    const result = {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please process this message: ${message}`
        }
      }]
    }
    return result
  }
)

const app = express()
app.use(express.json())

app.all('/mcp', async (req, res) => {
  try {
    await transport.handleRequest(req, res, req.body)
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: `Internal server error: ${error.message}`,
        },
        id: null,
      })
    }
  }
})

async function start() {
  // Connect the server to the transport
  await server.connect(transport)
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => {
    console.log(`MCP server listening on port ${PORT}`)
  })
}

start()
