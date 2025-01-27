/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

exports.config = {
  app_name: ['My Application'],
  license_key: 'test1234567890',
  logging: {
    level: 'trace',
    filepath: '../../../newrelic_agent.log'
  }
}
