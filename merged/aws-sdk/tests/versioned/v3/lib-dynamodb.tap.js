/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const common = require('../common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../aws-server-stubs')

tap.test('DynamoDB', (t) => {
  t.autoend()

  let helper = null
  let ddbCommands = null
  let DynamoDBDocumentClient = null

  let tableName = null
  let tests = null
  let client = null

  let server = null

  t.beforeEach(async () => {
    server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    helper = utils.TestAgent.makeInstrumented()
    common.registerCoreInstrumentation(helper)
    helper.registerInstrumentation({
      moduleName: '@aws-sdk/lib-dynamodb',
      type: 'datastore',
      onResolved: require('../../../lib/v3/lib-dynamodb')
    })

    const lib = require('@aws-sdk/lib-dynamodb')
    DynamoDBDocumentClient = lib.DynamoDBDocumentClient
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
    ddbCommands = {
      PutCommand: lib.PutCommand,
      GetCommand: lib.GetCommand,
      UpdateCommand: lib.UpdateCommand,
      DeleteCommand: lib.DeleteCommand,
      QueryCommand: lib.QueryCommand,
      ScanCommand: lib.ScanCommand
    }

    const endpoint = `http://localhost:${server.address().port}`
    client = new DynamoDBClient({
      credentials: FAKE_CREDENTIALS,
      endpoint: endpoint,
      region: 'us-east-1'
    })

    tableName = `delete-aws-sdk-test-table-${Math.floor(Math.random() * 100000)}`
    tests = createTests(tableName)
  })

  t.afterEach(() => {
    server.destroy()
    server = null

    helper && helper.unload()
    helper = null

    tests = null
    tableName = null
    client = null
    DynamoDBDocumentClient = null
    Object.keys(require.cache).forEach((key) => {
      if (
        key.includes('@aws-sdk/lib-dynamodb') ||
        key.includes('@aws-sdk/client-dynamodb') ||
        key.includes('@aws-sdk/smithy-client')
      ) {
        delete require.cache[key]
      }
    })
  })

  t.test('client commands', (t) => {
    const docClient = new DynamoDBDocumentClient(client)
    helper.runInTransaction(async function (tx) {
      for (let i = 0; i < tests.length; i++) {
        const cfg = tests[i]
        t.comment(`Testing ${cfg.operation}`)

        try {
          await docClient.send(new ddbCommands[cfg.command](cfg.params))
        } catch (err) {
          t.error(err)
        }
      }

      tx.end()

      const args = [t, tests, tx]
      setImmediate(finish, ...args)
    })
  })

  t.test('client commands via callback', (t) => {
    const docClient = new DynamoDBDocumentClient(client)
    helper.runInTransaction(async function (tx) {
      for (const test of tests) {
        t.comment(`Testing ${test.operation}`)

        await new Promise((resolve) => {
          docClient.send(new ddbCommands[test.command](test.params), (err) => {
            t.error(err)

            return setImmediate(resolve)
          })
        })
      }

      tx.end()

      const args = [t, tests, tx]
      setImmediate(finish, ...args)
    })
  })

  t.test('client from commands', (t) => {
    const docClientFrom = DynamoDBDocumentClient.from(client)
    helper.runInTransaction(async function (tx) {
      for (let i = 0; i < tests.length; i++) {
        const cfg = tests[i]
        t.comment(`Testing ${cfg.operation}`)

        try {
          await docClientFrom.send(new ddbCommands[cfg.command](cfg.params))
        } catch (err) {
          t.error(err)
        }
      }

      tx.end()

      const args = [t, tests, tx]
      setImmediate(finish, ...args)
    })
  })
})

function finish(t, tests, tx) {
  const root = tx.trace.root
  const segments = common.checkAWSAttributes(t, root, common.DATASTORE_PATTERN)

  t.equal(segments.length, tests.length, `should have ${tests.length} aws datastore segments`)

  const externalSegments = common.checkAWSAttributes(t, root, common.EXTERN_PATTERN)
  t.equal(externalSegments.length, 0, 'should not have any External segments')

  segments.forEach((segment, i) => {
    const operation = tests[i].operation
    t.equal(
      segment.name,
      `Datastore/operation/DynamoDB/${operation}`,
      'should have operation in segment name'
    )
    const attrs = segment.attributes.get(common.SEGMENT_DESTINATION)
    t.match(
      attrs,
      {
        'host': String,
        'port_path_or_id': String,
        'product': 'DynamoDB',
        'collection': String,
        'aws.operation': operation,
        'aws.requestId': String,
        'aws.region': 'us-east-1',
        'aws.service': 'DynamoDB'
      },
      'should have expected attributes'
    )
  })

  t.end()
}

function createTests(tableName) {
  const docUniqueArtist = `DELETE_One You Know ${Math.floor(Math.random() * 100000)}`
  const docPutParams = getDocPutItemParams(tableName, docUniqueArtist)
  const docItemParams = getDocItemParams(tableName, docUniqueArtist)
  const docQueryParams = getDocQueryParams(tableName, docUniqueArtist)

  const composedTests = [
    { params: docPutParams, operation: 'PutItemCommand', command: 'PutCommand' },
    { params: docItemParams, operation: 'GetItemCommand', command: 'GetCommand' },
    { params: docItemParams, operation: 'UpdateItemCommand', command: 'UpdateCommand' },
    { params: { TableName: tableName }, operation: 'ScanCommand', command: 'ScanCommand' },
    { params: docQueryParams, operation: 'QueryCommand', command: 'QueryCommand' },
    { params: docItemParams, operation: 'DeleteItemCommand', command: 'DeleteCommand' }
  ]

  return composedTests
}

function getDocPutItemParams(tableName, uniqueArtist) {
  const params = {
    Item: {
      AlbumTitle: 'Somewhat Famous',
      Artist: uniqueArtist,
      SongTitle: 'Call Me Today'
    },
    TableName: tableName
  }

  return params
}

function getDocItemParams(tableName, uniqueArtist) {
  const params = {
    Key: {
      Artist: uniqueArtist,
      SongTitle: 'Call Me Today'
    },
    TableName: tableName
  }

  return params
}

function getDocQueryParams(tableName, uniqueArtist) {
  const params = {
    ExpressionAttributeValues: {
      ':v1': uniqueArtist
    },
    KeyConditionExpression: 'Artist = :v1',
    TableName: tableName
  }

  return params
}
