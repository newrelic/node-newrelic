/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { KAFKA } = require('../../metrics/names')

module.exports = recordMethodMetric

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
