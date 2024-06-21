/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const instrumentProducer = require('./producer')
const instrumentConsumer = require('./consumer')
const { KAFKA } = require('../../metrics/names')

module.exports = function initialize(agent, kafkajs, _moduleName, shim) {
  if (agent.config.feature_flag.kafkajs_instrumentation === false) {
    shim.logger.debug(
      '`config.feature_flag.kafkajs_instrumentation is false, skipping instrumentation of kafkajs`'
    )
    return
  }

  shim.setLibrary(shim.KAFKA)
  instrumentConsumer({ shim, kafkajs, recordMethodMetric })
  instrumentProducer({ shim, kafkajs, recordMethodMetric })
}

/**
 * Convenience method for logging the tracking metrics for producer and consumer
 *
 * @param {object} params to function
 * @param {Agent} params.agent instance of agent
 * @param {string} params.name name of function getting instrumented
 */
function recordMethodMetric({ agent, name }) {
  agent.metrics.getOrCreateMetric(`${KAFKA.PREFIX}/${name}`).incrementCallCount()
}
