/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'security.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: false,
      description: 'Toggles the generation of security events by the security agent.'
    },
    agent: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: false
        }
      },
      additionalProperties: true,
      description: 'Flag to tell the Node.js agent to load the security agent. This property is read only once at application start.'
    },
    mode: {
      type: 'string',
      enum: [
        'IAST',
        'RASP'
      ],
      default: 'IAST',
      description: 'Security agent provides two modes: IAST and RASP. Default is IAST.'
    },
    validator_service_url: {
      type: 'string',
      default: 'wss://csec.nr-data.net',
      description: 'Security agent validator URL. Must be prefixed with wss://.'
    },
    detection: {
      type: 'object',
      properties: {
        rci: {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              default: true
            }
          },
          additionalProperties: true
        },
        rxss: {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              default: true
            }
          },
          additionalProperties: true
        },
        deserialization: {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              default: true
            }
          },
          additionalProperties: true
        }
      },
      additionalProperties: true,
      description: 'Provide ability to toggle sending security events for the following rules.'
    },
    iast_test_identifier: {
      type: 'string',
      default: '',
      description: 'Unique test identifier when running IAST with CI/CD'
    },
    scan_controllers: {
      type: 'object',
      properties: {
        iast_scan_request_rate_limit: {
          type: 'integer',
          default: 3600,
          description: 'The maximum number of analysis probes or requests that can be sent to the application in one minute.'
        },
        scan_instance_count: {
          type: 'integer',
          default: 0,
          description: 'The number of application instances for a specific entity where IAST analysis is performed. Values are 0 or 1, 0 signifies run on all application instances'
        }
      },
      additionalProperties: true,
      description: 'IAST scan controllers to get more control over IAST analysis'
    },
    scan_schedule: {
      type: 'object',
      properties: {
        delay: {
          type: 'integer',
          default: 0,
          description: 'The delay field specifies the time in minutes before an IAST scan begins after the application starts'
        },
        duration: {
          type: 'integer',
          default: 0,
          description: 'The duration field specifies the amount of time in minutes that the IAST scan will run'
        },
        schedule: {
          type: 'string',
          default: '',
          description: 'The schedule field specifies a unix cron expression that defines when the IAST scan should run. By default, schedule is disabled'
        },
        always_sample_traces: {
          type: 'boolean',
          default: false,
          description: 'Allows IAST to actively collect trace data in the background and the security agent will use this collected data to perform an IAST scan at the scheduled time'
        }
      },
      additionalProperties: true,
      description: 'Schedule start and stop of IAST scan'
    },
    exclude_from_iast_scan: {
      type: 'object',
      properties: {
        api: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: [],
          description: 'Ignore specific APIs from IAST analysis. The regex pattern should provide a full match for the URL without the endpoint.'
        },
        http_request_parameters: {
          type: 'object',
          properties: {
            header: {
              type: 'array',
              items: {
                type: 'string'
              },
              default: []
            },
            query: {
              type: 'array',
              items: {
                type: 'string'
              },
              default: []
            },
            body: {
              type: 'array',
              items: {
                type: 'string'
              },
              default: []
            }
          },
          additionalProperties: true,
          description: 'Ignore specific HTTP request parameters from IAST analysis.'
        },
        iast_detection_category: {
          type: 'object',
          properties: {
            insecure_settings: {
              type: 'boolean',
              default: false
            },
            invalid_file_access: {
              type: 'boolean',
              default: false
            },
            sql_injection: {
              type: 'boolean',
              default: false
            },
            nosql_injection: {
              type: 'boolean',
              default: false
            },
            ldap_injection: {
              type: 'boolean',
              default: false
            },
            javascript_injection: {
              type: 'boolean',
              default: false
            },
            command_injection: {
              type: 'boolean',
              default: false
            },
            xpath_injection: {
              type: 'boolean',
              default: false
            },
            ssrf: {
              type: 'boolean',
              default: false
            },
            rxss: {
              type: 'boolean',
              default: false
            }
          },
          additionalProperties: true,
          description: 'Allows users to specify categories of vulnerabilities for which IAST analysis will be applied or ignored.'
        }
      },
      additionalProperties: true,
      description: 'The exclude from IAST scan setting allows to exclude specific APIs, vulnerability categories, and parameters from IAST analysis.'
    }
  },
  additionalProperties: true,
  description: 'Security agent configurations'
}
