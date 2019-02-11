'use strict'

module.exports = {
  // Common http transaction trace attributes
  httpAttributes: [
    'request.headers.host',
    'request.method',
    'response.status',
    'httpResponseCode'
  ],
  // Default security policies
  securityPolicies: function() {
    return {
      record_sql: { enabled: false, required: false },
      attributes_include: { enabled: false, required: false },
      allow_raw_exception_messages: { enabled: false, required: false },
      custom_events: { enabled: false, required: false },
      custom_parameters: { enabled: false, required: false },
      custom_instrumentation_editor: { enabled: false, required: false },
      live_instrumentation: { enabled: false, required: false },
      message_parameters: { enabled: false, required: false },
      job_arguments: { enabled: false, required: false }
    }
  },
  // Default config for attribute filter
  defaultAttributeConfig: () => {
    return {
      attributes: {
        enabled: true,
        include_enabled: true,
        include: [],
        exclude: []
      },

      transaction_events: {
        attributes: {
          enabled: true,
          include: [],
          exclude: []
        }
      },

      transaction_tracer: {
        attributes: {
          enabled: true,
          include: [],
          exclude: []
        }
      },

      error_collector: {
        attributes: {
          enabled: true,
          include: [],
          exclude: []
        }
      },

      browser_monitoring: {
        attributes: {
          enabled: false,
          include: [],
          exclude: []
        }
      },

      span_events: {
        attributes: {
          enabled: true,
          include: [],
          exclude: []
        }
      },

      transaction_segments: {
        attributes: {
          enabled: true,
          include: [],
          exclude: []
        }
      }
    }
  }
}
