/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const newrelic = require('../../../index.js')

function greeter(name) {
  return `Hello ${name}`
}

if (newrelic.agent) {
  /* eslint-disable no-console */
  console.log(greeter(newrelic.agent.config.app_name))
  /* eslint-enable no-console */
}
