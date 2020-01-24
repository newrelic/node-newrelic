'use strict'

const common = require('./common')
const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const async = require('async')

const RETRY_MS = 1500
const RETRY_MAX_MS = 30000

// NOTE: these take a while to run and can trigger tap CLI file timeout
// This can be avoided via --no-timeout or --timeout=<value>
tap.test('DynamoDB', {timeout: 90000}, (t) => {
  t.autoend()

  let helper = null
  let AWS = null
  let notInstrumentedDdb = null

  let tableName = null
  let tests = null

  t.beforeEach((done) => {
    // For administrative tasks we don't want to impact metrics or risk breaking
    const notInstrumentedAws = require('aws-sdk')
    notInstrumentedDdb = new notInstrumentedAws.DynamoDB({region: 'us-east-1'})

    // Cleanup require cache so instrumentation will work afterwards.
    const awsPath = require.resolve('aws-sdk')
    delete require.cache[awsPath]

    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: 'aws-sdk',
      type: 'conglomerate',
      onRequire: require('../../lib/instrumentation')
    })

    AWS = require('aws-sdk')
    const ddb = new AWS.DynamoDB({region: 'us-east-1'})
    const docClient = new AWS.DynamoDB.DocumentClient({region: 'us-east-1'})

    tableName = `delete-aws-sdk-test-table-${Math.floor(Math.random() * 100000)}`
    tests = createTests(ddb, docClient, tableName)

    done()
  })

  t.afterEach((done) => {
    deleteTableIfNeeded(t, notInstrumentedDdb, tableName, () => {
      helper && helper.unload()

      helper = null

      notInstrumentedDdb = null
      AWS = null
      tests = null
      tableName = null

      done()
    })
  })

  t.test('commands with callback', (t) => {
    helper.runInTransaction((tx) => {
      async.eachSeries(tests, (cfg, cb) => {
        t.comment(`Testing ${cfg.method}`)
        cfg.api[cfg.method](cfg.params, (err) => {
          t.error(err)

          if (cfg.method === 'createTable') {
            const segment = helper.agent.tracer.getSegment()

            return waitTableCreated(t, notInstrumentedDdb, tableName, segment)
              .then(() => {
                setImmediate(cb)
              })
          }

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

          if (cfg.method === 'createTable') {
            const segment = helper.agent.tracer.getSegment()
            await waitTableCreated(t, notInstrumentedDdb, tableName, segment)
          }
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

async function waitTableCreated(t, ddb, tableName, segment, started) {
  // A hack to avoid this showing via outbound http instrumentation.
  forceOpaqueSegment(segment)

  let data = null
  try {
    data = await ddb.describeTable({ TableName: tableName }).promise()
  } catch (err) {
    t.error(err)
  }

  if (data && data.Table.TableStatus === 'ACTIVE') {
    segment.__NR_test_restoreOpaque()

    t.comment('Table is active.')
    return
  }

  const currentTime = Date.now()
  const startTime = started || currentTime
  const elapsed = currentTime - startTime

  if (elapsed > RETRY_MAX_MS) {
    segment.__NR_test_restoreOpaque()

    t.ok(false, `Should not take longer than ${RETRY_MAX_MS}ms for table create.`)
    return
  }

  t.comment(`Table does not yet exist, scheduling ${RETRY_MS}ms out.`)
  await delay(RETRY_MS)
  await waitTableCreated(t, ddb, tableName, segment, startTime)
}

function deleteTableIfNeeded(t, api, tableName, cb) {
  api.describeTable({ TableName: tableName }, (err, data) => {
    const tableExists = !(err && err.code === 'ResourceNotFoundException')

    if (!tableExists || (data && data.Table.TableStatus === 'DELETING')) {
      // table deleted or in process of deleting, all is good.
      return setImmediate(cb)
    }

    t.error(err)

    t.comment('Attempting to manually delete table')
    const deleteTableParams = getDeleteTableParams(tableName)
    return api.deleteTable(deleteTableParams, (err) => {
      t.error(err)
      cb()
    })
  })
}

/**
 * Manually sets segment.opaque to true.
 * Adds __NR_test_restoreOpaque to restore state.
 * @param {*} segment
 */
function forceOpaqueSegment(segment) {
  const originalOpaque = segment.opaque
  // Our promise instrumentation will reset opaque status each call
  // so we always need to set this.
  segment.opaque = true

  if (segment.__NR_test_restoreOpaque != null) {
    return
  }

  segment.__NR_test_restoreOpaque = function restoreOpaque() {
    segment.opaque = originalOpaque
    delete segment.__NR_test_restoreOpaque
  }
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

function delay(delayms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, delayms)
  })
}
