/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var benchmark = require('../../lib/benchmark')
var NameState = require('../../../lib/transaction/name-state')

var suite = benchmark.createBenchmark({name: 'Namestate#getPath'})

suite.add({
  name: 'empty',
  fn: function() {
    var ns = getNameState()
    ns.pathStack = []
    return ns.getPath()
  }
})

suite.add({
  name: 'small',
  fn: function() {
    var ns = getNameState()
    ns.pathStack = [{path: '/'}, {path: '/foo'}, {path: 'bar'}]
    return ns.getPath()
  }
})

suite.add({
  name: 'big',
  fn: function() {
    var ns = getNameState()
    ns.pathStack = [
      {path: '/'}, {path: '/foo'}, {path: 'bar'},
      {path: '/'}, {path: '/foo/'}, {path: 'bar'},
      {path: '/'}, {path: '/foo'}, {path: 'bar'},
      {path: '/'}, {path: '/foo/'}, {path: 'bar'},
      {path: '/'}, {path: '/foo/'}, {path: '/bar'}
    ]
    return ns.getPath()
  }
})


suite.run()

function getNameState() {
  return new NameState('prefix', 'GET', '/', null)
}
