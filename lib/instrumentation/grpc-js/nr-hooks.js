/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const grpc = require('./grpc')
const InstrumentationDescriptor = require('../../instrumentation-descriptor')

/**
 * Need to use nr-hooks style for grpc because we're instrumentation a submodule.
 */
module.exports = [
  {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    moduleName: '@grpc/grpc-js/build/src/resolving-call',
    isEsm: true,
    onRequire: grpc.wrapStartResolve
  },
  {
    type: InstrumentationDescriptor.TYPE_GENERIC,
    moduleName: '@grpc/grpc-js/build/src/call-stream',
    isEsm: true,
    onRequire: grpc.wrapStartCall
  },
  {
    type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
    moduleName: '@grpc/grpc-js/build/src/server',
    isEsm: true,
    onRequire: grpc.wrapServer
  }
]
