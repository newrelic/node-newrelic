/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const NameState = require('../../../lib/transaction/name-state')

const suite = benchmark.createBenchmark({ name: 'Namestate#getPath' })

suite.add({
  name: 'empty',
  fn: function () {
    const ns = getNameState()
    ns.pathStack = []
    return ns.getPath()
  }
})

suite.add({
  name: 'small',
  fn: function () {
    const ns = getNameState()
    ns.pathStack = [{ path: '/' }, { path: '/foo' }, { path: 'bar' }]
    return ns.getPath()
  }
})

suite.add({
  name: 'big',
  fn: function () {
    const ns = getNameState()
    ns.pathStack = [
      { path: '/' },
      { path: '/foo' },
      { path: 'bar' },
      { path: '/' },
      { path: '/foo/' },
      { path: 'bar' },
      { path: '/' },
      { path: '/foo' },
      { path: 'bar' },
      { path: '/' },
      { path: '/foo/' },
      { path: 'bar' },
      { path: '/' },
      { path: '/foo/' },
      { path: '/bar' }
    ]
    return ns.getPath()
  }
})

suite.run()

function getNameState() {
  return new NameState('prefix', 'GET', '/', null)
}
