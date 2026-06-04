/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('../../logger').child({
  component: 'opentelemetry-metrics-proxy-factory'
})
const { proxyAgent } = require('#agentlib/collector/http-agents.js')

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
  return function httpAgentFactory() {
    logger.trace('returning https proxy agent')
    return proxyAgent(agentConfig)
  }
}
