/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const TracerProvider = require('./tracer-provider')

module.exports = function instrumentOtel(shim, OtelNodeSdk) {
  const { agent } = shim
  if (agent.config.feature_flag.otel_sdk === false) {
    shim.logger.debug('`config.feature_flag.otel_sdk is false, skipping instrumentation of otel`')
    return
  }

  shim.wrapExport(OtelNodeSdk, () => {
    return new Proxy(OtelNodeSdk, {
      get(target, prop) {
        if (prop === 'NodeTracerProvider') {
          return TracerProvider.bind(agent)
        }
        return target[prop]
      }
    })
  })
}

