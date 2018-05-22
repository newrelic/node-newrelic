'use strict'

const LASP_MAP = {
  // LASP key
  record_sql: {
    // full path to corresponding config key
    path: 'transaction_tracer.record_sql',
    // Mapping from policy enabled status to usable config value
    // first element is policy is off, second is policy is on
    allowedValues: ['off', 'obfuscated'],
    // Tracks the precedent of settings controlled by LASP.
    filter: function mostSecureRecordSQL(first, second) {
      // Ordered from least to most secure
      var recordSQLSettings = ['obfuscated', 'off']
      var firstIdx = recordSQLSettings.indexOf(first)
      var secondIdx = recordSQLSettings.indexOf(second)
      if (firstIdx < 0 && secondIdx < 0) {
        // Return the most secure possible
        return recordSQLSettings[recordSQLSettings.length - 1]
      }
      return firstIdx < secondIdx ? second : first
    },
    // Invokes agent method to drop any corresponding data
    clearData: function resetCollectedData(agent) {
      agent._resetQueries(true)
    }
  },

  attributes_include: {
    path: 'attributes.include_enabled',
    allowedValues: [false, true],
    filter: function mostSecureAttributesInclude(first, second) {
      return first && second
    },
    clearData: function clearCollectedData(agent) {
      if (agent.config.attributes.enabled && agent.config.attributes.include.length) {
        agent.traces._rawReset()
      }
    }
  },

  // TODO: rename config key, because the names contradict each other's behavior
  allow_raw_exception_messages: {
    path: 'strip_exception_messages.enabled',
    allowedValues: [true, false],
    filter: function mostSecureStripException(first, second) {
      return first || second
    },
    clearData: function resetErrors(agent) {
      agent._resetErrors(true)
    }
  },

  custom_events: {
    path: 'api.custom_events_enabled',
    allowedValues: [false, true],
    filter: function mostSecureCustomEvents(first, second) {
      return first && second
    },
    clearData: function resetCustomEvents(agent) {
      agent._resetCustomEvents(true)
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
        agent.traces._rawReset()
      }
    }
  },
  // Unimplemented
  custom_instrumentation_editor: null,
  message_parameters: null,
  job_arguments: null
}

exports.LASP_MAP = LASP_MAP
