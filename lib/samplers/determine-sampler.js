/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const AdaptiveSampler = require('./adaptive-sampler')

/**
 * A helper function for the Agent to determine what sampler
 * to use and will log messages about the chosen sampler.
 * @param {*} params Function parameters.
 * @param {Agent} params.agent The New Relic agent instance.
 * @param {object} params.config The relevant configuration options to create the sampler.
 * @returns {object} An AdaptiveSampler or a TraceIdRatioBasedSampler, depending on given configuration.
 */
function determineSampler({ agent, config }) {
  if (!agent || !config) {
    throw new Error('Agent instance and config are required')
  }
  const dt = config?.distributed_tracing
  if (dt?.sampler?.root?.trace_id_ratio_based) {
    throw new Error('not implemented yet!')
  }

  // TODO: Based on config parameters, choose AdaptiveSampler or TraceIdRatioBasedSampler
  return new AdaptiveSampler({
    agent,
    serverless: config.serverless_mode.enabled,
    period: config.sampling_target_period_in_seconds * 1000,
    target: config.sampling_target // alias for dt.sampler.adaptive_sampling_target, see config/index.js
  })
}

module.exports = determineSampler
