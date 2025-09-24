/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base')
const { MCP } = require('../../metrics/names')

class McpClientRequestSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@modelcontextprotocol/sdk', channelName: 'nr_request' })
    this.events = ['asyncEnd']
  }

  get enabled() {
    return super.enabled && this.config.ai_monitoring.enabled === true
  }

  /**
   * Determine the MCP function to record based on the incoming request.
   * @param {*} args0 - The arguments passed to the request.
   * @returns {object} - An object containing the MCP prefix, function name, and primitive name.
   */
  determineFunction(args0) {
    const methodName = args0?.method
    let mcpPrefix
    let functionName
    let primitiveName

    if (methodName === 'tools/call') {
      mcpPrefix = MCP.TOOL
      functionName = 'callTool'
      primitiveName = args0?.params?.name ?? 'tool'
    } else if (methodName === 'prompts/get') {
      mcpPrefix = MCP.PROMPT
      functionName = 'getPrompt'
      primitiveName = args0?.params?.name ?? 'prompt'
    } else if (methodName === 'resources/read') {
      mcpPrefix = MCP.RESOURCE
      functionName = 'readResource'
      const uri = args0?.params?.uri
      primitiveName = typeof uri === 'string' ? uri.split('://')[0] : 'resource'
    } else {
      this.logger.debug(`@modelcontextprotocol/sdk: Will not create '${methodName}' segment.`)
    }
    return { mcpPrefix, functionName, primitiveName }
  }

  handler(data, ctx) {
    const { mcpPrefix, functionName, primitiveName } = this.determineFunction(data?.arguments?.[0])
    if (!mcpPrefix || !functionName || !primitiveName) {
      // If it is not a function we care about, don't instrument at all
      return
    }

    const segmentName = `${mcpPrefix}/${functionName}/${primitiveName}`
    return this.createSegment({
      name: segmentName,
      ctx
    })
  }
}

module.exports = McpClientRequestSubscriber
