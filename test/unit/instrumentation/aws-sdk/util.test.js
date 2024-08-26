/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const {
  grabLastUrlSegment,
  setDynamoParameters
} = require('../../../../lib/instrumentation/aws-sdk/util')
const DatastoreParameters = require('../../../../lib/shim/specs/params/datastore')

test('Utility Functions', async () => {
  assert.ok(grabLastUrlSegment, 'imported function successfully')

  const fixtures = [
    {
      input: '/foo/baz/bar',
      output: 'bar'
    },
    {
      input: null,
      output: ''
    },
    {
      input: undefined,
      output: ''
    },
    {
      input: NaN,
      output: ''
    }
  ]

  for (const [, fixture] of fixtures.entries()) {
    const result = grabLastUrlSegment(fixture.input)
    assert.equal(result, fixture.output, `expecting ${result} to equal ${fixture.output}`)
  }
})

test('DB parameters', async (t) => {
  await t.test('default values', (t, end) => {
    const input = {}
    const endpoint = {}
    const result = setDynamoParameters(endpoint, input)
    assert.deepEqual(
      result,
      new DatastoreParameters({
        host: undefined,
        database_name: null,
        port_path_or_id: 443,
        collection: 'Unknown'
      }),
      'should set default values for parameters'
    )
    end()
  })

  // v2 uses host key
  await t.test('host, port, collection', (t, end) => {
    const input = { TableName: 'unit-test' }
    const endpoint = { host: 'unit-test-host', port: '123' }
    const result = setDynamoParameters(endpoint, input)
    assert.deepEqual(
      result,
      {
        host: endpoint.host,
        database_name: null,
        port_path_or_id: endpoint.port,
        collection: input.TableName
      },
      'should set appropriate parameters'
    )
    end()
  })

  // v3 uses hostname key
  await t.test('hostname, port, collection', (t, end) => {
    const input = { TableName: 'unit-test' }
    const endpoint = { hostname: 'unit-test-host', port: '123' }
    const result = setDynamoParameters(endpoint, input)
    assert.deepEqual(
      result,
      {
        host: endpoint.hostname,
        database_name: null,
        port_path_or_id: endpoint.port,
        collection: input.TableName
      },
      'should set appropriate parameters'
    )
    end()
  })
})
