/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { AiMonitoringSubscriber } = require('../ai-monitoring')
const { MCP } = require('../../metrics/names')

class McpClientRequestSubscriber extends AiMonitoringSubscriber {
  constructor({ agent, logger }) {
    // name is assigned but overwritten in handler as the name is dynamic
    super({ agent, logger, packageName: '@modelcontextprotocol/sdk', channelName: 'nr_request', trackingPrefix: MCP.TRACKING_PREFIX, name: 'unknown' })
    this.events = ['asyncEnd']
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

    this.name = `${mcpPrefix}/${functionName}/${primitiveName}`

    const newCtx = super.handler(data, ctx)
    if (newCtx?.segment && functionName === 'callTool') {
      newCtx.segment.addSpanAttribute('subcomponent', `{"type":"APM-AI_TOOL","name":"${primitiveName}"}`)
    }

    return newCtx
  }
}

module.exports = McpClientRequestSubscriber
