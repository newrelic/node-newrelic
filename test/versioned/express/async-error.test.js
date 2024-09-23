/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const path = require('path')
const test = require('node:test')
const fork = require('child_process').fork
const { isExpress5 } = require('./utils')

/*
 *
 * CONSTANTS
 *
 */
const COMPLETION = 27

test('Express async throw', { skip: isExpress5() }, function (t, end) {
  const erk = fork(path.join(__dirname, 'erk.js'))
  let timer

  erk.on('error', function (error) {
    assert.ok(!error)
    end()
  })

  erk.on('exit', function (code) {
    clearTimeout(timer)
    assert.notEqual(code, COMPLETION, "request didn't complete")
    end()
  })

  // wait for the child vm to boot
  erk.on('message', function (message) {
    if (message === 'ready') {
      timer = setTimeout(function () {
        end(new Error('hung waiting for exit'))
        erk.kill()
      }, 1000)
      timer.unref()
      erk.send(COMPLETION)
    }
  })
})
