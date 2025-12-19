/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Sampler = require('./sampler')
const AdaptiveSampler = require('./adaptive-sampler')
const AlwaysOffSampler = require('./always-off-sampler')
const AlwaysOnSampler = require('./always-on-sampler')
const TraceIdRatioBasedSampler = require('./ratio-based-sampler')
const logger = require('../logger').child({ component: 'samplers' })
const { PARTIAL_TYPES } = require('../transaction')
const { SAMPLERS } = require('#agentlib/metrics/names.js')

/**
 * Manages the different samplers used for distributed tracing sampling decisions.
 * Selecting the appropriate sampler based on the configuration and context is done via the `applySamplingDecision` and `applyDTSamplingDecision` methods.
 *
 * @typedef {object} Samplers
 * @property {boolean} fullEnabled Whether full granularity sampling is enabled.
 * @property {boolean} partialEnabled Whether partial granularity sampling is enabled.
 * @property {AdaptiveSampler|null} adaptiveSampler The global adaptive sampler instance;
 * this is shared if `sampling_target` is not defined for a sampler type of `adaptive`.
 * @property {Sampler} root The root sampler for traces originating in application.
 * @property {Sampler} remoteParentSampled The sampler for traces with a remote parent that is sampled.
 * @property {Sampler} remoteParentNotSampled The sampler for traces with a remote parent that is not sampled.
 * @property {Sampler} partialRoot The partial granularity root sampler for traces originating in application.
 * @property {Sampler} partialRemoteParentSampled The partial granularity sampler for traces with a remote parent that is sampled.
 * @property {Sampler} partialRemoteParentNotSampled The partial granularity sampler for traces with a remote parent that is not sampled.
 */
class Samplers {
  constructor(agent) {
    this.fullEnabled = agent.config.distributed_tracing.enabled && agent.config.distributed_tracing.sampler.full_granularity.enabled
    this.partialEnabled = agent.config.distributed_tracing.enabled && agent.config.distributed_tracing.sampler.partial_granularity.enabled
    this.partialType = PARTIAL_TYPES[agent.config.distributed_tracing.sampler.partial_granularity.type.toUpperCase()]
    this.adaptiveSampler = null
    this.root = this.determineSampler({ agent, sampler: 'root' })
    this.remoteParentSampled = this.determineSampler({ agent, sampler: 'remote_parent_sampled' })
    this.remoteParentNotSampled = this.determineSampler({ agent, sampler: 'remote_parent_not_sampled' })
    this.partialRoot = this.determineSampler({ agent, sampler: 'root', isPartial: true })
    this.partialRemoteParentSampled = this.determineSampler({ agent, sampler: 'remote_parent_sampled', isPartial: true })
    this.partialRemoteParentNotSampled = this.determineSampler({ agent, sampler: 'remote_parent_not_sampled', isPartial: true })
    this.#sendCoreTracingMetrics(agent)
  }

  /**
   * Sends relevant Core Tracing metrics on startup in the form:
   * `Supportability/Nodejs/<granularity type>/<sampler section>/<sampler type>`
   * @param {Agent} agent agent instance with these `Samplers`
   */
  #sendCoreTracingMetrics(agent) {
    const metrics = agent.metrics
    if (this.partialEnabled) {
      // Supportability/Nodejs/PartialGranularity/<sampler section>/<sampler type>
      metrics.getOrCreateMetric(`${SAMPLERS.PARTIAL.ROOT}/${this.#determineSamplerType(this.partialRoot)}`)
      metrics.getOrCreateMetric(`${SAMPLERS.PARTIAL.PARENT_SAMPLED}/${this.#determineSamplerType(this.partialRemoteParentSampled)}`)
      metrics.getOrCreateMetric(`${SAMPLERS.PARTIAL.PARENT_NOT_SAMPLED}/${this.#determineSamplerType(this.partialRemoteParentNotSampled)}`)
    }
    if (this.fullEnabled) {
      // Supportability/Nodejs/PartialGranularity/<sampler section>/<sampler type>
      metrics.getOrCreateMetric(`${SAMPLERS.FULL.ROOT}/${this.#determineSamplerType(this.root)}`)
      metrics.getOrCreateMetric(`${SAMPLERS.FULL.PARENT_SAMPLED}/${this.#determineSamplerType(this.remoteParentSampled)}`)
      metrics.getOrCreateMetric(`${SAMPLERS.FULL.PARENT_NOT_SAMPLED}/${this.#determineSamplerType(this.remoteParentNotSampled)}`)
    }
  }

  /**
   *
   * @param {Sampler} sampler an instance of a Sampler
   * @returns {string} 'Adaptive/Shared', 'Adaptive', 'AlwaysOn', 'AlwaysOff', or 'TraceIdRatioBased'
   */
  #determineSamplerType(sampler) {
    if (sampler === this.adaptiveSampler) {
      return 'Adaptive/Shared'
    }
    return sampler.toString().replace('Sampler', '')
  }

  /**
   * Fallback sampling decision. This should only be called if DT is disabled or both full and partial granularity are disabled
   * @param {object} params to function
   * @param {Transaction} params.transaction The transaction to apply the sampling decision to.
   */
  applyDefaultDecision({ transaction }) {
    logger.trace('Both full and partial granularity samplers are disabled. Applying default sampling decision of not sampled and and a random priority between 0 and 1 for transaction %s', transaction.id)
    transaction.sampled = false
    transaction.priority = Sampler.generatePriority()
  }

  /**
   * Determines if the partial granularity sampler should run based on the transaction's sampled value and if partial granularity is enabled.
   * @param {Transaction} transaction The transaction to check.
   * @returns {boolean} True if the partial granularity sampler should run, false otherwise.
   */
  shouldRunPartialSampling(transaction) {
    return transaction.sampled !== true && this.partialEnabled
  }

  /**
   * Applies the root sampler's sampling decision to the transaction
   * if priority has not already been set. If both full and partial granularity
   * are in use, the full granularity sampler runs first then the partial granularity sampler.
   *
   * @param {Transaction} transaction The transaction to apply the sampling decision to.
   */
  applySamplingDecision({ transaction }) {
    if (!transaction) {
      logger.trace('No transaction provided to applySamplingDecision, not applying sampler.')
      return
    }

    if (transaction.priority !== null) {
      logger.trace('Transaction %s already has a sampling decision, not applying sampler.', transaction.id)
      return
    }

    if (this.fullEnabled === false && this.partialEnabled === false) {
      this.applyDefaultDecision({ transaction })
      return
    }

    if (this.fullEnabled) {
      this.root.applySamplingDecision({ transaction })
      logger.trace('Ran full granularity applySamplingDecision %s sampler for transaction %s, decision: { sampled: %s, priority: %d }', this.root.toString(), transaction.id, transaction.sampled, transaction.priority)
    }

    if (this.shouldRunPartialSampling(transaction)) {
      this.partialRoot.applySamplingDecision({ transaction, partialType: this.partialType })
      logger.trace('Ran partial granularity applySamplingDecision %s sampler for transaction %s, decision: { sampled: %s, priority: %d }', this.partialRoot.toString(), transaction.id, transaction.sampled, transaction.priority)
    }
  }

  /**
   * Applies the appropriate remote parent sampler's sampling decision
   * based on if the traceparent is sampled or not.
   * In the case of adaptive sampler it relies on the tracestate sampling flag
   *
   * @param {object} params to function
   * @param {Transaction} params.transaction The transaction to apply the sampling decision to.
   * @param {TraceParent} params.traceparent The W3C traceparent object.
   * @param {TraceState} params.tracestate The W3C tracestate object.
   */
  applyDTSamplingDecision({ transaction, traceparent, tracestate }) {
    if (!transaction) {
      logger.trace('No transaction provided to applyDTSamplingDecision, not applying sampler.')
      return
    }

    if (this.fullEnabled === false && this.partialEnabled === false) {
      this.applyDefaultDecision({ transaction })
      return
    }

    if (this.fullEnabled) {
      const sampler = traceparent?.isSampled ? this.remoteParentSampled : this.remoteParentNotSampled
      sampler.applySamplingDecision({ transaction, tracestate })
      logger.trace('Ran full granularity applyDTSamplingDecision %s sampler for transaction %s, decision: { sampled: %s, priority: %d }', sampler.toString(), transaction.id, transaction.sampled, transaction.priority)
    }

    if (this.shouldRunPartialSampling(transaction)) {
      const partialSampler = traceparent?.isSampled ? this.partialRemoteParentSampled : this.partialRemoteParentNotSampled
      partialSampler.applySamplingDecision({ transaction, tracestate, partialType: this.partialType })
      logger.trace('Ran partial granularity applyDTSamplingDecision %s sampler for transaction %s, decision: { sampled: %s, priority: %d }', partialSampler.toString(), transaction.id, transaction.sampled, transaction.priority)
    }
  }

  /**
   * Even though New Relic headers are deprecated,
   * we still have to apply our sampling decision on top
   * of the priority and sampled values we receive.
   * However, this only applies if the sampler is NOT
   * the default sampler (adaptive). In that case,
   * we leave it alone. ¯\_(ツ)_/¯
   *
   * @param {object} params to function
   * @param {Transaction} params.transaction The transaction to apply the sampling decision to.
   * @param {boolean} params.isSampled The sampled value from the legacy New Relic headers.
   */
  applyLegacyDTSamplingDecision({ transaction, isSampled }) {
    if (!transaction) {
      logger.trace('No transaction provided to applyLegacyDTSamplingDecision, not applying sampler.')
      return
    }

    if (this.fullEnabled === false && this.partialEnabled === false) {
      this.applyDefaultDecision({ transaction })
      return
    }

    if (this.fullEnabled) {
      const sampler = isSampled ? this.remoteParentSampled : this.remoteParentNotSampled
      if (sampler.toString() === 'AdaptiveSampler') {
        logger.trace('Not running full granularity applyLegacyDTSamplingDecision for transaction %s because sampler is AdaptiveSampler', transaction.id)
      } else {
        sampler.applySamplingDecision({ transaction })
        logger.trace('Ran full granularity applyLegacyDTSamplingDecision %s sampler for transaction %s, decision: { sampled: %s, priority: %d }', sampler.toString(), transaction.id, transaction.sampled, transaction.priority)
      }
    }

    if (this.shouldRunPartialSampling(transaction)) {
      const partialSampler = isSampled ? this.partialRemoteParentSampled : this.partialRemoteParentNotSampled
      if (partialSampler.toString() === 'AdaptiveSampler') {
        logger.trace('Not running partial granularity applyLegacyDTSamplingDecision for transaction %s because sampler is AdaptiveSampler', transaction.id)
      } else {
        partialSampler.applySamplingDecision({ transaction, partialType: this.partialType })
        logger.trace('Ran partial granularity applyLegacyDTSamplingDecision %s sampler for transaction %s, decision: { sampled: %s, priority: %d }', partialSampler.toString(), transaction.id, transaction.sampled, transaction.priority)
      }
    }
  }

  /**
   * Updates the adaptive sampler's target if it exists when server side config sends a new value down
   * @param {number} target The new target value to set
   */
  updateAdaptiveTarget(target) {
    if (this.adaptiveSampler) {
      this.adaptiveSampler.samplingTarget = target
    }
  }

  /**
   * Updates the adaptive sampler's period if it exists when server side config sends a new value down
   * @param {number} period The new period value to set in seconds
   */
  updateAdaptivePeriod(period) {
    if (this.adaptiveSampler) {
      this.adaptiveSampler.samplingPeriod = period * 1000
    }
  }

  /**
   * Returns the global adaptive sampler, creating it if it doesn't exist yet
   * @param {Agent} agent The New Relic agent instance.
   * @returns {AdaptiveSampler} The global AdaptiveSampler instance.
   */
  getAdaptiveSampler(agent) {
    if (this.adaptiveSampler !== null) {
      return this.adaptiveSampler
    }

    const config = agent.config
    this.adaptiveSampler = new AdaptiveSampler({
      agent,
      serverless: config.serverless_mode.enabled,
      period: config.sampling_target_period_in_seconds * 1000,
      target: config.sampling_target
    })
    return this.adaptiveSampler
  }

  /**
   * Determines which sampler to use and will log messages about the chosen sampler.
   * @param {object} params to function
   * @param {Agent} params.agent The New Relic agent instance.
   * @param {string} params.sampler The sampler type to use: 'root', 'remote_parent_sampled', or 'remote_parent_not_sampled'.
   * @param {boolean} params.isPartial Whether to determine the partial granularity sampler.
   * @returns {Sampler} A Sampler e.g. AdaptiveSampler
   */
  determineSampler({ agent, sampler, isPartial }) {
    const config = agent.config
    let samplerDefinition = null
    if (isPartial) {
      samplerDefinition = config.distributed_tracing.sampler.partial_granularity[sampler]
    } else {
      samplerDefinition = config.distributed_tracing.sampler[sampler]
    }

    // Always on?
    if (samplerDefinition === 'always_on') {
      return new AlwaysOnSampler()
    }

    // Always off?
    if (samplerDefinition === 'always_off') {
      return new AlwaysOffSampler()
    }

    // Is it TraceIdRatioBased?
    if (samplerDefinition?.trace_id_ratio_based) {
      let ratio = samplerDefinition.trace_id_ratio_based?.ratio
      // If both partial and full granularity for a particular section are both set to trace ratio, agent **MUST** set the partial granularity ratio = full granularity ratio + partial granularity ratio
      if (isPartial && this.fullEnabled && config.distributed_tracing.sampler[sampler]?.trace_id_ratio_based?.ratio) {
        ratio += config.distributed_tracing.sampler[sampler].trace_id_ratio_based.ratio
      }
      return new TraceIdRatioBasedSampler({
        agent,
        ratio
      })
    }

    // If adaptive.sampling_target set, create a new AdaptiveSampler,
    // else use the global AdaptiveSampler.
    if (samplerDefinition?.adaptive?.sampling_target) {
      return new AdaptiveSampler({
        agent,
        serverless: config.serverless_mode.enabled,
        period: config.sampling_target_period_in_seconds * 1000,
        target: samplerDefinition.adaptive.sampling_target
      })
    } else {
      return this.getAdaptiveSampler(agent)
    }
  }
}

module.exports = Samplers
