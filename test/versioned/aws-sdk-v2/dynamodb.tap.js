/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const common = require('../aws-sdk-v3/common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const { match } = require('../../lib/custom-assertions')
const promiseResolvers = require('../../lib/promise-resolvers')

test('DynamoDB', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    ctx.nr.server = server

    ctx.nr.agent = helper.instrumentMockedAgent()

    const AWS = require('aws-sdk')

    const endpoint = `http://localhost:${server.address().port}`
    const ddb = new AWS.DynamoDB({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
    const docClient = new AWS.DynamoDB.DocumentClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })

    const tableName = `delete-aws-sdk-test-table-${Math.floor(Math.random() * 100000)}`
    ctx.nr.tests = createTests(ddb, docClient, tableName)
  })

  t.afterEach((ctx) => {
    ctx.nr.server.close()
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('commands with callback', (t, end) => {
    const { tests, agent } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      for (const test of tests) {
        await new Promise((resolve) => {
          test.api[test.method](test.params, (err) => {
            assert.ok(!err)
            return setImmediate(resolve)
          })
        })
      }

      tx.end()

      const args = [end, tests, tx]
      setImmediate(finish, ...args)
    })
  })

  await t.test('commands with promises', async (t) => {
    const { tests, agent } = t.nr
    const { promise, resolve } = promiseResolvers()
    helper.runInTransaction(agent, async function (tx) {
      // Execute commands in order
      // Await works because this is in a for-loop / no callback api
      for (const test of tests) {
        try {
          await test.api[test.method](test.params).promise()
        } catch (err) {
          assert.ok(!err)
        }
      }

      tx.end()

      const args = [resolve, tests, tx]
      setImmediate(finish, ...args)
    })
    await promise
  })
})

function finish(end, tests, tx) {
  const root = tx.trace.root
  const segments = common.checkAWSAttributes(root, common.DATASTORE_PATTERN)

  assert.equal(segments.length, tests.length, `should have ${tests.length} aws datastore segments`)

  const externalSegments = common.checkAWSAttributes(root, common.EXTERN_PATTERN)
  assert.equal(externalSegments.length, 0, 'should not have any External segments')

  segments.forEach((segment, i) => {
    const operation = tests[i].operation
    assert.equal(
      segment.name,
      `Datastore/operation/DynamoDB/${operation}`,
      'should have operation in segment name'
    )
    const attrs = segment.attributes.get(common.SEGMENT_DESTINATION)
    attrs.port_path_or_id = parseInt(attrs.port_path_or_id, 10)
    match(attrs, {
      'host': String,
      'port_path_or_id': Number,
      'product': 'DynamoDB',
      'collection': String,
      'aws.operation': operation,
      'aws.requestId': String,
      'aws.region': 'us-east-1',
      'aws.service': 'DynamoDB'
    })
  })

  end()
}

function createTests(ddb, docClient, tableName) {
  const ddbUniqueArtist = `DELETE_One You Know ${Math.floor(Math.random() * 100000)}`
  const createTblParams = getCreateTableParams(tableName)
  const putItemParams = getPutItemParams(tableName, ddbUniqueArtist)
  const itemParams = getItemParams(tableName, ddbUniqueArtist)
  const queryParams = getQueryParams(tableName, ddbUniqueArtist)
  const deleteTableParams = getDeleteTableParams(tableName)

  const docUniqueArtist = `DELETE_One You Know ${Math.floor(Math.random() * 100000)}`
  const docPutParams = getDocPutItemParams(tableName, docUniqueArtist)
  const docItemParams = getDocItemParams(tableName, docUniqueArtist)
  const docQueryParams = getDocQueryParams(tableName, docUniqueArtist)

  return [
    { api: ddb, method: 'createTable', params: createTblParams, operation: 'createTable' },
    { api: ddb, method: 'putItem', params: putItemParams, operation: 'putItem' },
    { api: ddb, method: 'getItem', params: itemParams, operation: 'getItem' },
    { api: ddb, method: 'updateItem', params: itemParams, operation: 'updateItem' },
    { api: ddb, method: 'scan', params: { TableName: tableName }, operation: 'scan' },
    { api: ddb, method: 'query', params: queryParams, operation: 'query' },
    { api: ddb, method: 'deleteItem', params: itemParams, operation: 'deleteItem' },

    { api: docClient, method: 'put', params: docPutParams, operation: 'putItem' },
    { api: docClient, method: 'get', params: docItemParams, operation: 'getItem' },
    { api: docClient, method: 'update', params: docItemParams, operation: 'updateItem' },
    { api: docClient, method: 'scan', params: { TableName: tableName }, operation: 'scan' },
    { api: docClient, method: 'query', params: docQueryParams, operation: 'query' },
    { api: docClient, method: 'delete', params: docItemParams, operation: 'deleteItem' },

    { api: ddb, method: 'deleteTable', params: deleteTableParams, operation: 'deleteTable' }
  ]
}

function getCreateTableParams(tableName) {
  return {
    AttributeDefinitions: [
      { AttributeName: 'Artist', AttributeType: 'S' },
      { AttributeName: 'SongTitle', AttributeType: 'S' }
    ],
    KeySchema: [
      { AttributeName: 'Artist', KeyType: 'HASH' },
      { AttributeName: 'SongTitle', KeyType: 'RANGE' }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    },
    TableName: tableName
  }
}

function getPutItemParams(tableName, uniqueArtist) {
  return {
    Item: {
      AlbumTitle: { S: 'Somewhat Famous' },
      Artist: { S: uniqueArtist },
      SongTitle: { S: 'Call Me Today' }
    },
    TableName: tableName
  }
}

function getItemParams(tableName, uniqueArtist) {
  return {
    Key: {
      Artist: { S: uniqueArtist },
      SongTitle: { S: 'Call Me Today' }
    },
    TableName: tableName
  }
}

function getQueryParams(tableName, uniqueArtist) {
  return {
    ExpressionAttributeValues: {
      ':v1': { S: uniqueArtist }
    },
    KeyConditionExpression: 'Artist = :v1',
    TableName: tableName
  }
}

function getDeleteTableParams(tableName) {
  return {
    TableName: tableName
  }
}

function getDocPutItemParams(tableName, uniqueArtist) {
  return {
    Item: {
      AlbumTitle: 'Somewhat Famous',
      Artist: uniqueArtist,
      SongTitle: 'Call Me Today'
    },
    TableName: tableName
  }
}

function getDocItemParams(tableName, uniqueArtist) {
  return {
    Key: {
      Artist: uniqueArtist,
      SongTitle: 'Call Me Today'
    },
    TableName: tableName
  }
}

function getDocQueryParams(tableName, uniqueArtist) {
  return {
    ExpressionAttributeValues: {
      ':v1': uniqueArtist
    },
    KeyConditionExpression: 'Artist = :v1',
    TableName: tableName
  }
}
