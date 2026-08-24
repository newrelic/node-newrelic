/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const agentRunAsync = {
  path: './google-adk/agent-run-async.js',
  instrumentations: [
    {
      channelName: 'nr_agentRunAsync',
      module: { name: '@google/adk', versionRange: '>=1.1.0 <2.0.0', filePath: 'dist/cjs/agents/base_agent.js' },
      functionQuery: {
        className: 'BaseAgent',
        methodName: 'runAsync',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_agentRunAsync',
      module: { name: '@google/adk', versionRange: '>=2.0.0', filePath: 'dist/cjs/agents/base_agent.js' },
      functionQuery: {
        className: '_BaseAgent',
        methodName: 'runAsync',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_agentRunAsync',
      module: { name: '@google/adk', versionRange: '>=1.1.0 <2.0.0', filePath: 'dist/esm/agents/base_agent.js' },
      functionQuery: {
        className: 'BaseAgent',
        methodName: 'runAsync',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_agentRunAsync',
      module: { name: '@google/adk', versionRange: '>=2.0.0', filePath: 'dist/esm/agents/base_agent.js' },
      functionQuery: {
        className: 'BaseAgent',
        methodName: 'runAsync',
        // v2.0.0 does the following:
        //
        // ```
        // const _BaseAgent = class _BaseAgent {}
        // const BaseAgent = _BaseAgent
        // export { BaseAgent }
        // ```
        //
        // This is equivalent to `export { _BaseAgent as BaseAgent }`, which
        // is what `isExportAlias` is designed to support.
        isExportAlias: true,
        kind: 'Async'
      }
    }
  ]
}

const toolRunAsync = {
  path: './google-adk/tool-run-async.js',
  instrumentations: [
    {
      channelName: 'nr_toolRunAsync',
      module: { name: '@google/adk', versionRange: '>=1.1.0 <2.0.0', filePath: 'dist/cjs/tools/function_tool.js' },
      functionQuery: {
        className: 'FunctionTool',
        methodName: 'runAsync',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_toolRunAsync',
      module: { name: '@google/adk', versionRange: '>=2.0.0', filePath: 'dist/cjs/tools/function_tool.js' },
      functionQuery: {
        className: '_FunctionTool',
        methodName: 'runAsync',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_toolRunAsync',
      module: { name: '@google/adk', versionRange: '>=1.1.0 <2.0.0', filePath: 'dist/esm/tools/function_tool.js' },
      functionQuery: {
        className: 'FunctionTool',
        methodName: 'runAsync',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_toolRunAsync',
      module: { name: '@google/adk', versionRange: '>=2.0.0', filePath: 'dist/esm/tools/function_tool.js' },
      functionQuery: {
        className: 'FunctionTool',
        methodName: 'runAsync',
        isExportAlias: true,
        kind: 'Async'
      }
    }
  ]
}

module.exports = {
  '@google/adk': [
    agentRunAsync,
    toolRunAsync
  ]
}
