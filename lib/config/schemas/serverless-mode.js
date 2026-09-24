/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'serverless-mode.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: false,
      description: 'Specifies whether the agent will be used to monitor serverless functions (e.g. AWS Lambda). Defaults to true when the AWS_LAMBDA_FUNCTION_NAME environment variable is present, false otherwise.'
    }
  },
  additionalProperties: true,
  description: 'Specifies whether the agent will be used to monitor serverless functions. For example: AWS Lambda'
}
