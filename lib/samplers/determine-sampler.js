/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const AdaptiveSampler = require('./adaptive-sampler')
const TraceIdRatioBasedSampler = require('./ratio-based-sampler')

/**
 * A helper function for the Agent to determine what sampler
 * to use and will log messages about the chosen sampler.
 * @param {*} params Function parameters.
 * @param {Agent} params.agent The New Relic agent instance.
 * @param {object} params.config The entire agent config.
 * @returns {object} An AdaptiveSampler or a TraceIdRatioBasedSampler, depending on given configuration.
 */
function determineSampler({ agent, config }) {
  const ratioBasedSampler = config?.distributed_tracing?.sampler?.root?.trace_id_ratio_based

  if (ratioBasedSampler?.ratio) {
    return new TraceIdRatioBasedSampler({
      agent,
      ratio: ratioBasedSampler.ratio
    })
  }

  if (ratioBasedSampler && !ratioBasedSampler.ratio) {
    // Our config should be set up in a way where this would never be true,
    // but the spec says that if this occurs, we need to log an error.
    agent.logger.warn(
      'trace_id_ratio_based sampler is configured without a ratio, defaulting to adaptive sampler'
    )
  }

  return new AdaptiveSampler({
    agent,
    serverless: config.serverless_mode.enabled,
    period: config.sampling_target_period_in_seconds * 1000,
    target: config.sampling_target // alias for dt.sampler.adaptive_sampling_target, see config/index.js
  })
}

module.exports = determineSampler
