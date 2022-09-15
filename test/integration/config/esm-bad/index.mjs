/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import newrelic from '../../../../index.js'

export default function greeter(name) {
  return `Hello ${name}`
}

if (newrelic.agent) {
  /* eslint-disable no-console */
  console.log(greeter(newrelic.agent.config.app_name))
  /* eslint-enable no-console */
}
