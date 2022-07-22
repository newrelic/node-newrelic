/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const grpc = require('./grpc')

/**
 * Need to use nr-hooks style for grpc because we're using the onResolved hook
 * to register instrumentation.
 */
module.exports = [
  {
    type: 'conglomerate', // generic shim for client, web framework shim for server
    moduleName: '@grpc/grpc-js',
    onResolved: grpc
  }
]
