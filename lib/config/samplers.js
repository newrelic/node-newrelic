/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { allowList, float, int } = require('./formatters')

/**
 * This configuration is currently the same for `distributed_tracing.sampler` and `distributed_tracing.sampler.partial_granularity`
 * Note: This also just defines the outer structure.  These values are mixed data types. Most of the time
 * it is just a string. But if you want to use the `trace_id_ratio_based` sampler, then you need to
 * provide an object with a `ratio` property. All of that mapping is done in `lib/config/index.js`
 * This is done to allow compatibility with how OpenTelemetry sets their samplers and be backwards compatible as well.
 */
const config = {
  /**
   * Example setting root sampler via config to a string value -
   *  root: 'always_on'
   *
   * Example setting root sampler via config to trace id ratio based -
   * root: {
   *   trace_id_ratio_based: {
   *    ratio: 0.5
   *   }
   * }
   */
  root: {
    formatter: allowList.bind(null, ['trace_id_ratio_based', 'adaptive', 'always_on', 'always_off']),
    default: 'adaptive',
  },

  /**
   * When set to `always_on`, the sampled flag in the `traceparent` header
   * being set to "true" will result in the local transaction being sampled
   * with a priority value of "2". When set to `always_off`, the local
   * transaction will never be sampled. At the default setting, the sampling
   * decision will be determined according to the normal algorithm.
   *
   * This setting takes precedence over the `remote_parent_not_sampled`
   * setting.
   */
  remote_parent_sampled: {
    formatter: allowList.bind(null, ['trace_id_ratio_based', 'adaptive', 'always_on', 'always_off']),
    default: 'adaptive',
  },

  /**
   * When set to `always_on`, the local transaction will be sampled with a
   * priority of "2".
   * When set to `always_off`, the local transaction will never be sampled.
   * At the default setting, the sampling decision will be determined
   * according to the normal algorithm.
   *
   * This setting only affects decisions when the traceparent sampled flag
   * is set to 0.
   */
  remote_parent_not_sampled: {
    formatter: allowList.bind(null, ['trace_id_ratio_based', 'adaptive', 'always_on', 'always_off']),
    default: 'adaptive',
  }
}

/**
 * Builds the `trace_id_ratio_based.ratio` and `adaptive.sampling_target`
 * for distributed tracing sampler configuration structure.
 *
 * @param {object} params to function
 * @param {object} params.config - The full configuration object
 * @param {string} params.key - The configuration key being processed
 * @param {object} params.configToUpdate - The internal configuration object being modified
 * @param {Logger} params.logger - The logger instance
 */
function buildSamplers({ config, key, configToUpdate, logger }) {
  if (!isValidDTSampler(key)) {
    return
  }

  const samplerConfig = config[key]
  const samplers = Object.keys(samplerConfig)

  // user can set the following samplers:
  // 'root', 'remote_parent_sampled', and `remote_parent_not_sampled'
  // under 'distributed_tracing.sampler` and `distributed_tracing.sampler.partial_granularity`
  for (const sampler of samplers) {
    if (isAdaptiveSamplingTargetConfig(sampler, samplerConfig)) {
      const samplingValue = samplerConfig[sampler].adaptive.sampling_target
      // sampling_target is an int [1, 120]
      if (samplingValue && samplingValue >= 1 && samplingValue <= 120) {
        configToUpdate[key][sampler] = {
          adaptive: {
            sampling_target: samplingValue
          }
        }
        logger.trace('Setting adaptive.sampling_target on %s.%s', key, sampler)
      } else {
        logger.trace('Not setting adaptive.sampling_target on %s.%s as value is not in range [1,120].', key, sampler)
      }
    }

    if (isTraceIdRatioBasedConfig(sampler, samplerConfig)) {
      const ratioValue = samplerConfig[sampler].trace_id_ratio_based.ratio
      if (typeof ratioValue === 'number') {
        configToUpdate[key][sampler] = {
          trace_id_ratio_based: {
            ratio: ratioValue
          }
        }
        logger.trace('Setting trace_id_ratio_based.ratio on %s.%s', key, sampler)
      } else {
        logger.trace('Not setting trace_id_ratio_based on %s.%s as ratio value is not present.', key, sampler)
      }
    }
  }
}

/**
 * Assigns the value of the distributed tracing samplers env var as an
 * trace_id_ratio_based or adaptive object to the sampler in the config.
 *
 * @param {object} params object passed to fn
 * @param {string} params.key key of the sampler
 * Example: 'root' or 'remote_parent_sampled'
 * @param {object} params.config agent config
 * @param {Array} params.paths list of leaf nodes leading to the sampling configuration value
 * Example: ['distributed_tracing', 'sampler']
 * @param {Function} params.setNestedKey function to set nested key in config
 * @param {Logger} params.logger logger instance
 */
function setSamplersFromEnv({ key, config, paths, setNestedKey, logger }) {
  if (paths.length === 0) {
    return
  }

  const lastPath = paths[paths.length - 1]
  if (!isValidDTSampler(lastPath) || !isValidDTSamplerType(key)) {
    return
  }

  const nestedValue = getNestedValue(config, [...paths, key])

  if (nestedValue === 'trace_id_ratio_based') {
    handleTraceIdRatioBased({ paths, key, config, setNestedKey, logger })
  } else if (nestedValue === 'adaptive') {
    handleAdaptiveSampling({ paths, key, config, setNestedKey, logger })
  }
}

function handleTraceIdRatioBased({ paths, key, config, setNestedKey, logger }) {
  const envVar = `NEW_RELIC_${[...paths, key, 'trace_id_ratio_based', 'ratio'].join('_').toUpperCase()}`
  const setting = process.env[envVar]

  if (setting) {
    const formattedSetting = float(setting)
    setNestedKey(config, [...paths, key], { trace_id_ratio_based: { ratio: formattedSetting } })
    logger.trace('Setting %s environment variable to %s', envVar, formattedSetting)
  } else {
    logger.trace('Not setting %s environment variable. Setting %s.%s to `adaptive`', envVar, paths.join('.'), key)
    setNestedKey(config, [...paths, key], 'adaptive')
  }
}

function handleAdaptiveSampling({ paths, key, config, setNestedKey, logger }) {
  const envVar = `NEW_RELIC_${[...paths, key, 'adaptive', 'sampling_target'].join('_').toUpperCase()}`
  const setting = process.env[envVar]

  if (setting) {
    const formattedSetting = int(setting)
    if (formattedSetting >= 1 && formattedSetting <= 120) {
      setNestedKey(config, [...paths, key], { adaptive: { sampling_target: formattedSetting } })
      logger.trace('Setting %s environment variable to %s', envVar, formattedSetting)
    } else {
      logger.trace('Not setting %s environment variable; value not in range [1,120]. Setting %s.%s as `adaptive` with no `sampling_target`',
        envVar,
        paths.join('.'),
        key)
      setNestedKey(config, [...paths, key], 'adaptive')
    }
  }
}

/**
 * Checks if the external config contains a trace_id_ratio_based for distributed tracing
 * sampler configuration
 *
 * @param {string} sampler - The selected sampler key
 * @param {object} samplerConfig - The sampler configuration object
 * @returns {boolean} true if it's a trace_id_ratio_based config
 */
function isTraceIdRatioBasedConfig(sampler, samplerConfig) {
  return isValidDTSamplerType(sampler) &&
   typeof samplerConfig[sampler] === 'object' &&
    'trace_id_ratio_based' in samplerConfig[sampler]
}

/**
 * Checks if the external config contains a adaptive object
 * for distributed tracing sampler configuration
 *
 * @param {string} sampler - The selected sampler key
 * @param {object} samplerConfig - The sampler configuration object
 * @returns {boolean} true if it's a adaptive config
 */
function isAdaptiveSamplingTargetConfig(sampler, samplerConfig) {
  return isValidDTSamplerType(sampler) &&
   typeof samplerConfig[sampler] === 'object' &&
    'adaptive' in samplerConfig[sampler]
}

/**
 * Check if the sampler is a valid value of either 'sampler', 'full_granularity', or 'partial_granularity'
 * @param {string} sampler - The sampler key to validate
 * @returns {boolean} true if valid, false otherwise
 */
function isValidDTSampler(sampler) {
  return ['sampler', 'partial_granularity'].includes(sampler)
}

/**
 * Check if the sampler type is a valid value of either 'root', 'remote_parent_sampled', or 'remote_parent_not_sampled'.
 * @param {string} samplerType - The sampler type to validate
 * @returns {boolean} true if valid, false otherwise
 */
function isValidDTSamplerType(samplerType) {
  return ['root', 'remote_parent_sampled', 'remote_parent_not_sampled'].includes(samplerType)
}

/**
 * Retrieves a value from a nested object by providing the list of parent keys.
 * @param {object} obj object to assign value to
 * @param {Array} keys list of parent keys
 * @returns {*} value of the nested object key
 */
function getNestedValue(obj, keys) {
  const len = keys.length
  for (let i = 0; i < len - 1; i++) {
    const elem = keys[i]
    if (!obj[elem]) {
      obj[elem] = {}
    }

    obj = obj[elem]
  }
  return obj[keys[len - 1]]
}

module.exports = {
  config,
  buildSamplers,
  setSamplersFromEnv
}
