/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'cloud.js',
  type: 'object',
  properties: {
    aws: {
      type: 'object',
      properties: {
        account_id: {
          type: 'integer',
          default: null,
          description: 'The AWS account ID for the AWS account associated with this app.'
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true
}
