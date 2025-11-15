/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const express = require('express')
const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js')
const { z } = require('zod')

class McpTestServer {
  constructor() {
    this.server = new McpServer({
      name: 'test-server',
      version: '1.0.0',
      capabilities: {
        resources: {},
        tools: {},
        prompts: {}
      }
    })

    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableDnsRebindingProtection: true,
    })

    this.app = express()
    this.expressServer = null

    this._setupRoutes()
    this._registerMcpHandlers()
  }

  _setupRoutes() {
    this.app.use(express.json())
    this.app.all('/mcp', async (req, res) => {
      try {
        await this.transport.handleRequest(req, res, req.body)
      } catch (error) {
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: `Internal server error: ${error.message}`
            },
            id: null
          })
        }
      }
    })
  }

  _registerMcpHandlers() {
    this.server.registerResource(
      'echo',
      new ResourceTemplate('echo://{message}', { list: undefined }),
      {
        title: 'Echo Resource',
        description: 'Echoes back messages as resources'
      },
      async (uri, { message }) => {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Resource echo: ${message}`
            }
          ]
        }
      }
    )

    this.server.registerTool(
      'echo',
      {
        title: 'Echo Tool',
        description: 'Echoes back the provided message',
        inputSchema: { message: z.string() }
      },
      async ({ message }) => {
        return { content: [{ type: 'text', text: `Tool echo: ${message}` }] }
      }
    )

    this.server.registerPrompt(
      'echo',
      {
        title: 'Echo Prompt',
        description: 'Creates a prompt to process a message',
        argsSchema: { message: z.string() }
      },
      ({ message }) => {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please process this message: ${message}`
              }
            }
          ]
        }
      }
    )
  }

  async start() {
    const self = this
    await this.server.connect(this.transport)
    return new Promise((resolve) => {
      this.expressServer = this.app.listen(0, function onListen() {
        const port = this.address().port
        self.transport._allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`]
        resolve(port)
      })
    })
  }

  async stop() {
    await this.transport.close()
    this.server.close()

    return new Promise((resolve, reject) => {
      if (this.expressServer) {
        this.expressServer.close((err) => {
          if (err) {
            return reject(err)
          }
          this.expressServer = null
          resolve()
        })
      } else {
        resolve()
      }
    })
  }
}

module.exports = McpTestServer
