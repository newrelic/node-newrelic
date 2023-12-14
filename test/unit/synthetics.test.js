/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const proxyquire = require('proxyquire')
const sinon = require('sinon')

const hashes = require('../../lib/util/hashes')
const {
  SYNTHETICS_DATA,
  SYNTHETICS_INFO,
  SYNTHETICS_HEADER,
  SYNTHETICS_INFO_HEADER,
  ENCODING_KEY,
  SYNTHETICS_DATA_ARRAY
} = require('../helpers/synthetics')

// Other files test more functionality
// See:
//  * test/unit/analytics_events.test.js
//  * test/unit/instrumentation/http/synthetics.test.js
//  * test/unit/transaction.test.js
tap.test('synthetics helpers', (t) => {
  let sandbox
  let synthetics
  let loggerMock
  t.autoend()
  t.before(() => {
    sandbox = sinon.createSandbox()
    loggerMock = require('./mocks/logger')(sandbox)
    synthetics = proxyquire('../../lib/synthetics', {
      './logger': {
        child: sandbox.stub().callsFake(() => loggerMock)
      }
    })
  })

  t.afterEach(() => {
    sandbox.resetHistory()
  })

  t.test('should assign synthetics and synthetics info  header to transaction', (t) => {
    const tx = {}
    const headers = {
      'x-newrelic-synthetics': SYNTHETICS_HEADER,
      'x-newrelic-synthetics-info': SYNTHETICS_INFO_HEADER
    }
    synthetics.assignHeadersToTransaction(
      { trusted_account_ids: [567], encoding_key: ENCODING_KEY },
      tx,
      headers
    )
    t.same(loggerMock.trace.args[0], ['Parsed synthetics header: %s', SYNTHETICS_DATA_ARRAY])
    t.same(loggerMock.trace.args[1], ['Parsed synthetics info header: %s', SYNTHETICS_INFO])
    t.same(tx.syntheticsData, SYNTHETICS_DATA)
    t.equal(tx.syntheticsHeader, SYNTHETICS_HEADER)
    t.same(tx.syntheticsInfoData, SYNTHETICS_INFO)
    t.equal(tx.syntheticsInfoHeader, SYNTHETICS_INFO_HEADER)
    t.end()
  })
  t.test('should not assign header if unable to decode header', (t) => {
    const tx = {}
    const headers = {
      'x-newrelic-synthetics': 'bogus'
    }
    synthetics.assignHeadersToTransaction(
      { trusted_account_ids: [567], encoding_key: ENCODING_KEY },
      tx,
      headers
    )
    t.equal(loggerMock.trace.args[0][1], 'Cannot parse synthetics header: %s')
    t.equal(loggerMock.trace.args[0][2], 'bogus')
    t.same(tx, {})
    t.end()
  })
  t.test('should not assign synthetics header if not an array', (t) => {
    const header = hashes.obfuscateNameUsingKey(JSON.stringify({ key: 'value' }), ENCODING_KEY)
    const tx = {}
    const headers = {
      'x-newrelic-synthetics': header
    }
    synthetics.assignHeadersToTransaction(
      { trusted_account_ids: [567], encoding_key: ENCODING_KEY },
      tx,
      headers
    )
    t.equal(loggerMock.trace.args[1][0], 'Synthetics data is not an array.')
    t.same(tx, {})
    t.end()
  })

  t.test('should log trace warning if not all values synthetics header are in array', (t) => {
    const data = [...SYNTHETICS_DATA_ARRAY]
    data.pop()
    data.pop()

    const header = hashes.obfuscateNameUsingKey(JSON.stringify(data), ENCODING_KEY)
    const tx = {}
    const headers = {
      'x-newrelic-synthetics': header
    }
    synthetics.assignHeadersToTransaction(
      { trusted_account_ids: [567], encoding_key: ENCODING_KEY },
      tx,
      headers
    )
    t.same(loggerMock.trace.args[1], ['Synthetics header length is %s, expected at least %s', 3, 5])
    t.equal(tx.syntheticsHeader, header)
    t.same(tx.syntheticsData, {
      version: 1,
      accountId: 567,
      resourceId: 'resource',
      jobId: undefined,
      monitorId: undefined
    })
    t.end()
  })

  t.test('should not assign synthetics header if version is not 1', (t) => {
    const data = [...SYNTHETICS_DATA_ARRAY]
    data[0] = 2
    const header = hashes.obfuscateNameUsingKey(JSON.stringify(data), ENCODING_KEY)
    const tx = {}
    const headers = {
      'x-newrelic-synthetics': header
    }
    synthetics.assignHeadersToTransaction(
      { trusted_account_ids: [567], encoding_key: ENCODING_KEY },
      tx,
      headers
    )
    t.same(loggerMock.trace.args[1], ['Synthetics header version is not 1, got: %s', 2])
    t.same(tx, {})
    t.end()
  })

  t.test('should not assign synthetics header if account id is not in trusted ids', (t) => {
    const data = [...SYNTHETICS_DATA_ARRAY]
    data[1] = 999
    const header = hashes.obfuscateNameUsingKey(JSON.stringify(data), ENCODING_KEY)
    const tx = {}
    const headers = {
      'x-newrelic-synthetics': header
    }
    synthetics.assignHeadersToTransaction(
      { trusted_account_ids: [567, 243], encoding_key: ENCODING_KEY },
      tx,
      headers
    )
    t.same(loggerMock.trace.args[1], [
      'Synthetics header account ID is not in trusted account IDs: %s (%s)',
      999,
      '567,243'
    ])
    t.same(tx, {})
    t.end()
  })

  t.test('should not assign info header if unable to decode header', (t) => {
    const tx = {}
    const headers = {
      'x-newrelic-synthetics-info': 'bogus'
    }
    synthetics.assignHeadersToTransaction(
      { trusted_account_ids: [567], encoding_key: ENCODING_KEY },
      tx,
      headers
    )
    t.equal(loggerMock.trace.args[0][1], 'Cannot parse synthetics info header: %s')
    t.equal(loggerMock.trace.args[0][2], 'bogus')
    t.same(tx, {})
    t.end()
  })
  t.test('should not assign info header if object is empty', (t) => {
    const header = hashes.obfuscateNameUsingKey(JSON.stringify([1]), ENCODING_KEY)
    const tx = {}
    const headers = {
      'x-newrelic-synthetics-info': header
    }
    synthetics.assignHeadersToTransaction(
      { trusted_account_ids: [567], encoding_key: ENCODING_KEY },
      tx,
      headers
    )
    t.equal(loggerMock.trace.args[1][0], 'Synthetics info data is not an object.')
    t.same(tx, {})
    t.end()
  })

  t.test('should not assign info header if version is not 1', (t) => {
    const data = { ...SYNTHETICS_INFO }
    data.version = 2
    const header = hashes.obfuscateNameUsingKey(JSON.stringify(data), ENCODING_KEY)
    const tx = {}
    const headers = {
      'x-newrelic-synthetics-info': header
    }
    synthetics.assignHeadersToTransaction(
      { trusted_account_ids: [567], encoding_key: ENCODING_KEY },
      tx,
      headers
    )
    t.same(loggerMock.trace.args[1], ['Synthetics info header version is not 1, got: %s', 2])
    t.same(tx, {})
    t.end()
  })
})
