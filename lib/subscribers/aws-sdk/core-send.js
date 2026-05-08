/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict'
const SmithyClientSendSubscriber = require('./send')

/**
 * Extends SmithyClientSendSubscriber to handle the new Client.send in `@smithy/core`
 * package, which newer versions of AWS SDK v3 versions depend on instead of `@smithy/smithy-client`.
 */
module.exports = class CoreClientSendSubscriber extends SmithyClientSendSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@smithy/core' })
  }
}
