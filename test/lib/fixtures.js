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
  }
}
