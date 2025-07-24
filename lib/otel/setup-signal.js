/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('#agentlib/logger.js').child({ component: 'opentelemetry-bridge' })

/**
 * SetupSignal is an interface to standardize how we bootstrap OpenTelemetry
 * observability signals within the OTEL bridge. Subclasses are expected to
 * implement their setup in the constructor, and to provide a `.teardown`
 * method that properly cleans up any created resources (i.e. unblocks the
 * parent singleton managed by the OTEL packages from being garbage collected).
 */
class SetupSignal {
  agent
  logger

  coreApi = require('@opentelemetry/api')

  constructor({ agent, logger = defaultLogger } = {}) {
    if (Object.prototype.toString.call(agent) !== '[object Agent]') {
      throw Error('must provide an instance of the New Relic agent')
    }

    this.agent = agent
    this.logger = logger
  }

  teardown() {
    this.logger.warn('teardown method is not implemented')
  }
}

module.exports = SetupSignal
