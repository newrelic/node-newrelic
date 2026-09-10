/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'process-host.js',
  type: 'object',
  properties: {
    display_name: {
      type: 'string',
      default: '',
      description: 'Configurable display name for hosts'
    },
    ipv_preference: {
      type: 'string',
      enum: [
        '4',
        '6'
      ],
      default: '4',
      description: 'ip address preference when creating hostnames'
    }
  },
  additionalProperties: true,
  description: "This is used to configure properties about the user's host name."
}
