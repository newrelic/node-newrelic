/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const ElasticSearchSubscriber = require('./elasticsearch')

class ElasticSearchTransportSubscriber extends ElasticSearchSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@elastic/transport' })
  }
}

module.exports = ElasticSearchTransportSubscriber
