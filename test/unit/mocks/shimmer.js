/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const sinon = require('sinon')
module.exports = (sandbox = sinon) => {
  return {
    bootstrapInstrumentation: sandbox.stub(),
    registerHooks: sandbox.stub(),
    registeredInstrumentations: {}
  }
}
