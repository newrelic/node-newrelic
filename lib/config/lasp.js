/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: would likely be easier to understand if the allowedValues mapping
// just took the raw enabled/disabled and translated. This is not a hot path.

/**
 * path: Full nested path for the local configuration item.
 * allowedValues:
 *   Array of valid config values to map for incoming enabled/disabled.
 *   policy.enabled: false uses index 0, policy.enabled: true uses index 1.
 * filter: Allows for calculating most secure setting to use
 * applyAdditionalSettings: Applies additional settings that are required
 *   when the policy is disabled.
 * clearData: Clears the relevant agent collection.
 */
const LASP_MAP = {
  // LASP key
  record_sql: {
    // full path to corresponding config key
    path: 'transaction_tracer.record_sql',
    // Mapping from policy enabled status to usable config value
    // policy.enabled: false === off, policy.enabled: true === 'obfuscated'
    allowedValues: ['off', 'obfuscated'],
    // Tracks the precedent of settings controlled by LASP.
    filter: function mostSecureRecordSQL(first, second) {
      // Ordered from least to most secure
      const recordSQLSettings = ['obfuscated', 'off']
      const firstIdx = recordSQLSettings.indexOf(first)
      const secondIdx = recordSQLSettings.indexOf(second)
      if (firstIdx < 0 && secondIdx < 0) {
        // Return the most secure possible
        return recordSQLSettings[recordSQLSettings.length - 1]
      }
      return firstIdx < secondIdx ? second : first
    },
    // Invokes agent method to drop any corresponding data
    clearData: function resetCollectedData(agent) {
      agent._resetQueries()
    }
  },

  attributes_include: {
    path: 'attributes.include_enabled',
    allowedValues: [false, true],
    filter: function mostSecureAttributesInclude(first, second) {
      return first && second
    },
    applyAdditionalSettings: function applyAdditionalSettings(config) {
      config.attributes.exclude.push('request.parameters.*')
    },
    clearData: function clearCollectedData(agent) {
      if (agent.config.attributes.enabled && agent.config.attributes.include.length) {
        agent.traces.clear()
      }
    }
  },

  // TODO: rename config key, because the names contradict each other's behavior
  allow_raw_exception_messages: {
    path: 'strip_exception_messages.enabled',
    // if raw messages are allowed, then we should not strip them
    // policy.enabled: false === true, policy.enabled: true === false
    allowedValues: [true, false],
    filter: function mostSecureStripException(first, second) {
      return first || second
    },
    clearData: function resetErrors(agent) {
      agent._resetErrors()
    }
  },

  custom_events: {
    path: 'api.custom_events_enabled',
    allowedValues: [false, true],
    filter: function mostSecureCustomEvents(first, second) {
      return first && second
    },
    clearData: function resetCustomEvents(agent) {
      agent._resetCustomEvents()
    }
  },

  custom_parameters: {
    path: 'api.custom_attributes_enabled',
    allowedValues: [false, true],
    filter: function mostSecureCustomAttributes(first, second) {
      return first && second
    },
    clearData: function resetCustomAttributes(agent) {
      if (agent.config.attributes.enabled) {
        agent.traces.clear()
      }
    }
  },
  // Unimplemented
  custom_instrumentation_editor: null,
  message_parameters: null,
  job_arguments: null
}

exports.LASP_MAP = LASP_MAP
