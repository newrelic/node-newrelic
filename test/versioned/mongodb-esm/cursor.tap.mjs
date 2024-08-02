/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import tap from 'tap'
import helper from '../../lib/agent_helper.js'
import { test } from './collection-common.mjs'
import { ESM } from './common.cjs'
const { STATEMENT_PREFIX } = ESM

tap.test('Cursor Tests', (t) => {
  t.autoend()
  let agent

  t.before(() => {
    agent = helper.instrumentMockedAgent()
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  test({ suiteName: 'count', agent, t }, function countTest(t, collection, verify) {
    collection.find({}).count(function onCount(err, data) {
      t.notOk(err, 'should not error')
      t.equal(data, 30, 'should have correct result')
      verify(null, [`${STATEMENT_PREFIX}/count`, 'Callback: onCount'], ['count'])
    })
  })

  test({ suiteName: 'explain', agent, t }, function explainTest(t, collection, verify) {
    collection.find({}).explain(function onExplain(err, data) {
      t.error(err)
      // Depending on the version of the mongo server the explain plan is different.
      if (data.hasOwnProperty('cursor')) {
        t.equal(data.cursor, 'BasicCursor', 'should have correct response')
      } else {
        t.ok(data.hasOwnProperty('queryPlanner'), 'should have correct response')
      }
      verify(null, [`${STATEMENT_PREFIX}/explain`, 'Callback: onExplain'], ['explain'])
    })
  })

  test({ suiteName: 'next', agent, t }, function nextTest(t, collection, verify) {
    collection.find({}).next(function onNext(err, data) {
      t.notOk(err)
      t.equal(data.i, 0)
      verify(null, [`${STATEMENT_PREFIX}/next`, 'Callback: onNext'], ['next'])
    })
  })

  test({ suiteName: 'toArray', agent, t }, function toArrayTest(t, collection, verify) {
    collection.find({}).toArray(function onToArray(err, data) {
      t.notOk(err)
      t.equal(data[0].i, 0)
      verify(null, [`${STATEMENT_PREFIX}/toArray`, 'Callback: onToArray'], ['toArray'])
    })
  })
})
