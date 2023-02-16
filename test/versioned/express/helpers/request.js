/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Polyfill till we drop support for Node 14
const { AbortController } = require('node-abort-controller')
const axios = require('axios')

process.on('message', (port) => {
  const controller = new AbortController()
  axios
    .post(`http://localhost:${port}/test`, { timeout: 1500 }, { signal: controller.signal })
    .catch(() => {
      // eslint-disable-next-line no-process-exit
      process.exit()
    })

  setTimeout(() => {
    controller.abort()
  }, 100)
})
