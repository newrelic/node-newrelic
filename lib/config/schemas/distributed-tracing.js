/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// A distributed-tracing sampler subfield accepts either a string naming the
// sampler, or an object selecting a parameterized sampler:
//   { trace_id_ratio_based: { ratio: <number> } }
//   { adaptive: { sampling_target: <integer 1-120> } }
// Note the string forms are only 'always_on', 'always_off', and 'adaptive'
// (which uses a default adaptive configuration). 'trace_id_ratio_based' is
// never valid as a bare string — it must be given as the object form above.
// See lib/config/samplers.js for how these object shapes are built and used.
const SAMPLER_NAMES = ['always_on', 'always_off', 'adaptive']

function sampler(description) {
  return {
    oneOf: [
      { type: 'string', enum: SAMPLER_NAMES },
      {
        type: 'object',
        properties: {
          trace_id_ratio_based: {
            type: 'object',
            properties: { ratio: { type: 'number' } },
            required: ['ratio'],
            additionalProperties: true
          }
        },
        required: ['trace_id_ratio_based'],
        additionalProperties: true
      },
      {
        type: 'object',
        properties: {
          adaptive: {
            type: 'object',
            properties: { sampling_target: { type: 'integer', minimum: 1, maximum: 120 } },
            additionalProperties: true
          }
        },
        required: ['adaptive'],
        additionalProperties: true
      }
    ],
    default: 'adaptive',
    // Marks a distributed-tracing sampler setting whose string value
    // ('trace_id_ratio_based'/'adaptive') is expanded into an object from a
    // second environment variable. See lib/config/apply-environment-overrides.js.
    'x-newrelic-sampler': true,
    description
  }
}

const ROOT_DESC = "Example setting root sampler via config to a string value - root: 'always_on' Example setting root sampler via config to trace id ratio based - root: { trace_id_ratio_based: { ratio: 0.5 } }"
const REMOTE_PARENT_SAMPLED_DESC = 'When set to `always_on`, the sampled flag in the `traceparent` header being set to "true" will result in the local transaction being sampled with a priority value of "2". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting takes precedence over the `remote_parent_not_sampled` setting.'
const REMOTE_PARENT_NOT_SAMPLED_DESC = 'When set to `always_on`, the local transaction will be sampled with a priority of "2". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting only affects decisions when the traceparent sampled flag is set to 0.'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'distributed-tracing.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: true,
      description: 'Enables/disables distributed tracing.'
    },
    exclude_newrelic_header: {
      type: 'boolean',
      default: true,
      description: 'Excludes New Relic format distributed tracing header (`newrelic`) on outbound requests when set to `true`. By default (when false) both W3C TraceContext (`traceparent`, `tracecontext`) and New Relic formats will be sent.'
    },
    sampler: {
      type: 'object',
      properties: {
        root: sampler(ROOT_DESC),
        remote_parent_sampled: sampler(REMOTE_PARENT_SAMPLED_DESC),
        remote_parent_not_sampled: sampler(REMOTE_PARENT_NOT_SAMPLED_DESC),
        adaptive_sampling_target: {
          type: 'integer',
          default: 10,
          minimum: 1,
          maximum: 120,
          description: "The sampling target for adaptive sampling is controlled via this attribute when configuring the default/adaptive sampler. The default sampling target is 10 transactions/min when it is not specified but **MUST** be within the range of [1, 120] (inclusive). Upon agent connect, the connect response **MUST** provide the value of `sampling_target` based on this configuration setting's value. The `sampling_target` value from the connect response **SHOULD** be used as the sampling target value for adaptive sampling in the agent."
        },
        full_granularity: {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              default: true
            }
          },
          additionalProperties: true
        },
        partial_granularity: {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              default: false
            },
            type: {
              type: 'string',
              enum: [
                'compact',
                'essential',
                'reduced'
              ],
              default: 'essential'
            },
            root: sampler(ROOT_DESC),
            remote_parent_sampled: sampler(REMOTE_PARENT_SAMPLED_DESC),
            remote_parent_not_sampled: sampler(REMOTE_PARENT_NOT_SAMPLED_DESC)
          },
          additionalProperties: true
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true,
  description: 'Controls the method of cross agent tracing in the agent. Distributed tracing lets you see the path that a request takes through your distributed system. Enabling distributed tracing changes the behavior of some New Relic features, so carefully consult the transition guide before you enable this feature: https://docs.newrelic.com/docs/transition-guide-distributed-tracing Default is true.'
}
