/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const grpc = require('./grpc')

/**
 * Need to use nr-hooks style for grpc because we're instrumentation a submodule.
 */
module.exports = [
  {
    type: 'generic',
    moduleName: '@grpc/grpc-js/build/src/resolving-call',
    isEsm: true,
    onRequire: grpc.wrapStartResolve
  },
  {
    type: 'generic',
    moduleName: '@grpc/grpc-js/build/src/call-stream',
    isEsm: true,
    onRequire: grpc.wrapStartCall
  },
  {
    type: 'web-framework',
    moduleName: '@grpc/grpc-js/build/src/server',
    isEsm: true,
    onRequire: grpc.wrapServer
  }
]
