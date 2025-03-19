/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 *
 * Instruments the PubSub library
 *
 * @param {Shim} shim instance of shim
 * @param {*} pubsub pubsub instance
 */
module.exports = function instrumentPubSub(shim) {
  // When running the agent in otel bridge mode,
  // GCP PubSub is fully instrumented. Thus,
  // if the user wants @google-cloud/pubsub to be instrumented,
  // just set the opentelemetry_bridge feature flag to true.
  const agent = shim.agent
  if (!agent.config.feature_flag.opentelemetry_bridge) {
    agent.config.feature_flag.opentelemetry_bridge = true
    shim.agent = agent
  }

  shim.setLibrary(shim.PUBSUB)
}
