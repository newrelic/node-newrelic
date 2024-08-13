/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const InstrumentationDescriptor = require('../../instrumentation-descriptor')

// TODO: Remove once we update agent instrumentation to not rely on full required path within Node.js
// When running Next.js app as a standalone server this is how the next-server is getting loaded
module.exports = [
  {
    type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
    moduleName: 'next/dist/server/next-server',
    onRequire: require('./next-server')
  },
  {
    type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
    moduleName: './next-server',
    onRequire: require('./next-server')
  }
]
