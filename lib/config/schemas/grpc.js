/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'grpc.js',
  type: 'object',
  properties: {
    record_errors: {
      type: 'boolean',
      default: true,
      description: 'Enables recording of non-zero gRPC status codes. Default is `true`.'
    },
    ignore_status_codes: {
      type: 'array',
      items: {
        type: 'string'
      },
      default: [],
      description: 'List of gRPC error status codes the error tracer should disregard. Ignoring a status code means that the transaction is not renamed to match the code, and the request is not treated as an error by the error collector. NOTE: This configuration value has no effect on errors recorded using `noticeError()`. Defaults to no codes ignored.'
    }
  },
  additionalProperties: true,
  description: 'Controls behavior of gRPC server instrumentation.'
}
