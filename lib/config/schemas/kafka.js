/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'kafka.js',
  type: 'object',
  properties: {
    metrics: {
      type: 'object',
      properties: {
        cluster: {
          type: 'object',
          properties: {
            metrics: {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean',
                  default: false,
                  description: 'Enables capture of the `MessageBroker/Kafka/Cluster/{cluster_id}/{Produce|Consume}/{topic_name}` metrics. Disabled by default.'
                }
              },
              additionalProperties: true
            }
          },
          additionalProperties: true
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true,
  description: 'Stanza for customizing behavior for Kafka instrumentation'
}
