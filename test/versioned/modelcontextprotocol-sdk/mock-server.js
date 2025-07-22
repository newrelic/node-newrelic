/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { z } = require('zod')

async function main() {
  const server = new McpServer({
    name: 'test-server',
    version: '1.0.0',
    capabilities: {
      resources: {},
      tools: {},
      prompts: {}
    },
  })

  server.registerResource(
    'echo',
    new ResourceTemplate('echo://{message}', { list: undefined }),
    {
      title: 'Echo Resource',
      description: 'Echoes back messages as resources'
    },
    async (uri, { message }) => ({
      contents: [{
        uri: uri.href,
        text: `Resource echo: ${message}`
      }]
    })
  )

  server.registerTool(
    'echo',
    {
      title: 'Echo Tool',
      description: 'Echoes back the provided message',
      inputSchema: { message: z.string() }
    },
    async ({ message }) => ({
      content: [{ type: 'text', text: `Tool echo: ${message}` }]
    })
  )

  server.registerPrompt(
    'echo',
    {
      title: 'Echo Prompt',
      description: 'Creates a prompt to process a message',
      argsSchema: { message: z.string() }
    },
    ({ message }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please process this message: ${message}`
        }
      }]
    })
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('Error starting mock server:', err)
  process.exit(1)
})
