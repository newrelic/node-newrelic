/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('../../logger').child({
  component: 'opentelemetry-metrics-proxy-factory'
})
const { buildProxyUrl, proxyAgent } = require('#agentlib/collector/http-agents.js')

/**
 * Builds a factory function compliant with OTEL's requirements for supplying
 * an `http.Agent` instance.
 *
 * @param {object} params Function parameters.
 * @param {AgentConfig} params.agentConfig Agent configuration instance.
 * @param {object} params.logger Agent logger instance.
 *
 * @returns {Function} Factory function for OTEL.
 */
module.exports = function generateProxyAgentFactory({
  agentConfig,
  logger = defaultLogger
}) {
  return function httpAgentFactory(protocol) {
    if (protocol.toLowerCase() === 'http') {
      // Our collector does not support HTTP. But we return a default
      // implementation here because it's not clear what will come from the
      // OTEL library and what we need to pass back in order to skip this
      // option.
      //
      // Note: as of 2026-05, this feature of `http.Agent` is still in
      // active development.
      //
      // Note: we import `node:http` lazily here as suggested by OTEL.
      const http = require('node:http')
      const proxyUrl = buildProxyUrl(agentConfig).replace('https://', 'http://')
      logger.trace('returning http proxy agent')
      return new http.Agent({
        proxyEnv: {
          HTTP_PROXY: proxyUrl
        }
      })
    }

    logger.trace('returning https proxy agent')
    return proxyAgent(agentConfig)
  }
}
