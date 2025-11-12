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

  // This slightly complicated boolean check is for the use case
  // where the customer sets `ratio` to 0, which is a falsey value.
  const validRatio = (typeof ratioBasedSampler?.ratio === 'number' && ratioBasedSampler.ratio >= 0 && ratioBasedSampler.ratio <= 1)
  if (validRatio) {
    return new TraceIdRatioBasedSampler({
      agent,
      ratio: ratioBasedSampler.ratio
    })
  }

  return new AdaptiveSampler({
    agent,
    serverless: config.serverless_mode.enabled,
    period: config.sampling_target_period_in_seconds * 1000,
    target: config.sampling_target // alias for dt.sampler.adaptive_sampling_target, see config/index.js
  })
}

module.exports = determineSampler
