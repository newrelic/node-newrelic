/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var benchmark = require('../../lib/benchmark')
var helper = require('../../lib/agent_helper')


var suite = benchmark.createBenchmark({
  name: 'config.filter',
  agent: {
    config: {
      attributes: {
        enabled: true,
        include: [
          'request.headers.global-include-exact',
          'request.headers.global-include-other',
          'request.headers.global-include-wild*',
          'request.headers.global-include-other*',
          'request.uri'
        ],
        exclude: [
          'request.headers.global-exclude-exact',
          'request.headers.global-exclude-other',
          'request.headers.global-exclude-wild*',
          'request.headers.global-exclude-other*'
        ]
      },
      transaction_tracer: {
        attributes: {
          enabled: true,
          include: [
            'request.headers.tt-include-exact',
            'request.headers.tt-include-other',
            'request.headers.tt-include-wild*',
            'request.headers.tt-include-other*'
          ],
          exclude: [
            'request.headers.tt-exclude-exact',
            'request.headers.tt-exclude-other',
            'request.headers.tt-exclude-wild*',
            'request.headers.tt-exclude-other*'
          ]
        }
      }
    }
  }
})

var attributes = [
  'request.headers.global-include-exact',
  'request.headers.global-include-wildcard',

  'request.headers.global-exclude-exact',
  'request.headers.global-exclude-wildcard',

  'request.headers.tt-include-exact',
  'request.headers.tt-include-wildcard',

  'request.headers.tt-exclude-exact',
  'request.headers.tt-exclude-wildcard',

  'request.headers.no-rules-match'
]

attributes.forEach(function(attr) {
  suite.add({
    name: attr,
    fn: function(agent) {
      helper.runInTransaction(agent, function(tx) {
        tx.trace.attributes.addAttribute(0xffff, attr, 'value')
      })
    }
  })
})

suite.run()
