/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('path')
const test = require('tap').test
const fork = require('child_process').fork

/*
 *
 * CONSTANTS
 *
 */
const COMPLETION = 27

test('Express async throw', function (t) {
  const erk = fork(path.join(__dirname, 'erk.js'))
  let timer

  erk.on('error', function (error) {
    t.fail(error)
    t.end()
  })

  erk.on('exit', function (code) {
    clearTimeout(timer)
    t.notEqual(code, COMPLETION, "request didn't complete")
    t.end()
  })

  // wait for the child vm to boot
  erk.on('message', function (message) {
    if (message === 'ready') {
      timer = setTimeout(function () {
        t.fail('hung waiting for exit')
        erk.kill()
      }, 1000)
      timer.unref()
      erk.send(COMPLETION)
    }
  })
})
