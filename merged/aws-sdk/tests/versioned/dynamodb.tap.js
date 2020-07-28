/*
* Copyright 2020 New Relic Corporation. All rights reserved.
* SPDX-License-Identifier: Apache-2.0
*/
'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const async = require('async')

const common = require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('./aws-server-stubs')

tap.test('DynamoDB', (t) => {
  t.autoend()

  let helper = null
  let AWS = null

  let tableName = null
  let tests = null

  let server = null

  t.beforeEach((done) => {
    server = createEmptyResponseServer()
    server.listen(0, () => {
      helper = utils.TestAgent.makeInstrumented()
      helper.registerInstrumentation({
        moduleName: 'aws-sdk',
        type: 'conglomerate',
        onRequire: require('../../lib/instrumentation')
      })

      AWS = require('aws-sdk')

      const endpoint = `http://localhost:${server.address().port}`
      const ddb = new AWS.DynamoDB({
        credentials: FAKE_CREDENTIALS,
        endpoint: endpoint,
        region: 'us-east-1'
      })
      const docClient = new AWS.DynamoDB.DocumentClient({
        credentials: FAKE_CREDENTIALS,
        endpoint: endpoint,
        region: 'us-east-1'
      })

      tableName = `delete-aws-sdk-test-table-${Math.floor(Math.random() * 100000)}`
      tests = createTests(ddb, docClient, tableName)

      done()
    })
  })

  t.afterEach((done) => {
    server.close()
    server = null

    helper && helper.unload()
    helper = null

    AWS = null
    tests = null
    tableName = null

    done()
  })

  t.test('commands with callback', (t) => {
    helper.runInTransaction((tx) => {
      async.eachSeries(tests, (cfg, cb) => {
        t.comment(`Testing ${cfg.method}`)
        cfg.api[cfg.method](cfg.params, (err) => {
          t.error(err)

          return setImmediate(cb)
        })
      }, () => {
        tx.end()

        const args = [t, tests, tx]
        setImmediate(finish, ...args)
      })
    })
  })

  t.test('commands with promises', (t) => {
    helper.runInTransaction(async function(tx) {
      // Execute commands in order
      // Await works because this is in a for-loop / no callback api
      for (let i = 0; i < tests.length; i++) {
        const cfg = tests[i]

        t.comment(`Testing ${cfg.method}`)

        try {
          await cfg.api[cfg.method](cfg.params).promise()
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

  t.equal(
    segments.length,
    tests.length,
    `should have ${tests.length} aws datastore segments`
  )

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
    t.matches(attrs, {
      'host': String,
      'port_path_or_id': String,
      'product': 'DynamoDB',
      'collection': String,
      'aws.operation': operation,
      'aws.requestId': String,
      'aws.region': 'us-east-1',
      'aws.service': 'DynamoDB'
    }, 'should have expected attributes')
  })

  t.end()
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

  const composedTests = [
    {api: ddb, method: 'createTable', params: createTblParams, operation: 'createTable'},
    {api: ddb, method: 'putItem', params: putItemParams, operation: 'putItem'},
    {api: ddb, method: 'getItem', params: itemParams, operation: 'getItem'},
    {api: ddb, method: 'updateItem', params: itemParams, operation: 'updateItem'},
    {api: ddb, method: 'scan', params: {TableName: tableName}, operation: 'scan'},
    {api: ddb, method: 'query', params: queryParams, operation: 'query'},
    {api: ddb, method: 'deleteItem', params: itemParams, operation: 'deleteItem'},

    {api: docClient, method: 'put', params: docPutParams, operation: 'putItem'},
    {api: docClient, method: 'get', params: docItemParams, operation: 'getItem'},
    {api: docClient, method: 'update', params: docItemParams, operation: 'updateItem'},
    {api: docClient, method: 'scan', params: {TableName: tableName}, operation: 'scan'},
    {api: docClient, method: 'query', params: docQueryParams, operation: 'query'},
    {api: docClient, method: 'delete', params: docItemParams, operation: 'deleteItem'},

    {api: ddb, method: 'deleteTable', params: deleteTableParams, operation: 'deleteTable'}
  ]

  return composedTests
}

function getCreateTableParams(tableName) {
  const params = {
    AttributeDefinitions: [
      {AttributeName: 'Artist', AttributeType: 'S'},
      {AttributeName: 'SongTitle', AttributeType: 'S'}
    ],
    KeySchema: [
      {AttributeName: 'Artist', KeyType: 'HASH'},
      {AttributeName: 'SongTitle', KeyType: 'RANGE'}
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    },
    TableName: tableName
  }

  return params
}

function getPutItemParams(tableName, uniqueArtist) {
  const params = {
    Item: {
      AlbumTitle: {S: 'Somewhat Famous'},
      Artist: {S: uniqueArtist},
      SongTitle: {S: 'Call Me Today'}
    },
    TableName: tableName
  }

  return params
}

function getItemParams(tableName, uniqueArtist) {
  const params = {
    Key: {
      Artist: {S: uniqueArtist},
      SongTitle: {S: 'Call Me Today'}
    },
    TableName: tableName
  }

  return params
}

function getQueryParams(tableName, uniqueArtist) {
  const params = {
    ExpressionAttributeValues: {
      ':v1': {S: uniqueArtist}
    },
    KeyConditionExpression: 'Artist = :v1',
    TableName: tableName
  }

  return params
}

function getDeleteTableParams(tableName) {
  const params = {
    TableName: tableName
  }

  return params
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
