'use strict'

const common = require('./common')
const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const async = require('async')

const RETRY_MS = 1500
const RETRY_MAX_MS = 15500

const TABLE_NAME = `DELETE_aws-sdk-test-table-${Math.floor(Math.random() * 100000)}`
const UNIQUE_ARTIST = `DELETE_One You Know ${Math.floor(Math.random() * 100000)}`

const TABLE_DEF = {
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
  TableName: TABLE_NAME
}

const ITEM_DEF = {
  Item: {
    AlbumTitle: {S: 'Somewhat Famous'},
    Artist: {S: UNIQUE_ARTIST},
    SongTitle: {S: 'Call Me Today'}
  },
  TableName: TABLE_NAME
}

const ITEM = {
  Key: {
    Artist: {S: UNIQUE_ARTIST},
    SongTitle: {S: 'Call Me Today'}
  },
  TableName: TABLE_NAME
}

const DELETE_TABLE = {
  TableName: TABLE_NAME
}

const QUERY = {
  ExpressionAttributeValues: {
    ':v1': {S: UNIQUE_ARTIST}
  },
  KeyConditionExpression: 'Artist = :v1',
  TableName: TABLE_NAME
}

const DOC_PUT_ITEM = {
  Item: {
    AlbumTitle: 'Somewhat Famous',
    Artist: UNIQUE_ARTIST,
    SongTitle: 'Call Me Today'
  },
  TableName: TABLE_NAME
}

const DOC_ITEM = {
  Key: {
    Artist: UNIQUE_ARTIST,
    SongTitle: 'Call Me Today'
  },
  TableName: TABLE_NAME
}

const DOC_QUERY = {
  ExpressionAttributeValues: {
    ':v1': UNIQUE_ARTIST
  },
  KeyConditionExpression: 'Artist = :v1',
  TableName: TABLE_NAME
}

let tests = null

function createTests(ddb, docClient) {
  const composedTests = [
    {api: ddb, method: 'createTable', params: TABLE_DEF, operation: 'createTable'},
    {api: ddb, method: 'putItem', params: ITEM_DEF, operation: 'putItem'},
    {api: ddb, method: 'getItem', params: ITEM, operation: 'getItem'},
    {api: ddb, method: 'updateItem', params: ITEM, operation: 'updateItem'},
    {api: ddb, method: 'scan', params: {TableName: TABLE_NAME}, operation: 'scan'},
    {api: ddb, method: 'query', params: QUERY, operation: 'query'},
    {api: ddb, method: 'deleteItem', params: ITEM, operation: 'deleteItem'},

    {api: docClient, method: 'put', params: DOC_PUT_ITEM, operation: 'putItem'},
    {api: docClient, method: 'get', params: DOC_ITEM, operation: 'getItem'},
    {api: docClient, method: 'update', params: DOC_ITEM, operation: 'updateItem'},
    {api: docClient, method: 'scan', params: {TableName: TABLE_NAME}, operation: 'scan'},
    {api: docClient, method: 'query', params: DOC_QUERY, operation: 'query'},
    {api: docClient, method: 'delete', params: DOC_ITEM, operation: 'deleteItem'},

    {api: ddb, method: 'deleteTable', params: DELETE_TABLE, operation: 'deleteTable'}
  ]

  return composedTests
}

tap.test('DynamoDB', (t) => {
  t.autoend()

  let helper = null
  let AWS = null
  let notInstrumentedDdb = null


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

    tests = createTests(ddb, docClient)

    done()
  })

  t.afterEach((done) => {
    deleteTableIfNeeded(t, notInstrumentedDdb, () => {
      helper && helper.unload()

      helper = null

      notInstrumentedDdb = null
      AWS = null
      tests = null

      done()
    })
  })

  t.test('commands', (t) => {
    helper.runInTransaction((tx) => {
      async.eachSeries(tests, (cfg, cb) => {
        t.comment(`Testing ${cfg.method}`)
        cfg.api[cfg.method](cfg.params, (err) => {
          t.error(err)

          if (cfg.method === 'createTable') {
            const segment = helper.agent.tracer.getSegment()
            return onTableCreated(t, notInstrumentedDdb, segment, cb)
          }

          return setImmediate(cb)
        })
      }, () => {
        tx.end()
        setImmediate(finish, t, tx)
      })
    })
  })
})

function finish(t, tx) {
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

function onTableCreated(t, ddb, segment, cb, started) {
  // A hack to avoid this showing via outbound http instrumentation.
  forceOpaqueSegment(segment)

  return ddb.describeTable({ TableName: TABLE_NAME }, (err, data) => {
    t.error(err)

    if (data.Table.TableStatus === 'ACTIVE') {
      segment.__NR_test_restoreOpaque()

      t.comment('Table is active.')
      return setImmediate(cb)
    }

    const currentTime = Date.now()
    const startTime = started || currentTime
    const elapsed = startTime - currentTime

    if (elapsed > RETRY_MAX_MS) {
      segment.__NR_test_restoreOpaque()

      t.ok(false, 'Should not take longer than 10s for table create.')
      return setImmediate(cb)
    }

    t.comment('Table does not yet exist, scheduling 100ms out.')

    const args = [t, ddb, segment, cb, startTime]

    return setTimeout(
      onTableCreated,
      RETRY_MS,
      ...args
    )
  })
}

/**
 * Manually sets segment.opaque to false.
 * Adds __NR_test_restoreOpaque to restore state.
 * @param {*} segment
 */
function forceOpaqueSegment(segment) {
  if (segment.__NR_test_restoreOpaque != null) {
    return
  }

  const originalOpaque = segment.opaque
  segment.opaque = true

  segment.__NR_test_restoreOpaque = function restoreOpaque() {
    segment.opaque = originalOpaque
    delete segment.__NR_test_restoreOpaque
  }
}

function deleteTableIfNeeded(t, api, cb) {
  api.describeTable({ TableName: TABLE_NAME }, (err, data) => {
    const tableExists = !(err && err.code === 'ResourceNotFoundException')

    if (!tableExists || (data && data.Table.TableStatus === 'DELETING')) {
      // table deleted or in process of deleting, all is good.
      return setImmediate(cb)
    }

    t.error(err)

    t.comment('Attempting to manually delete table')
    return api.deleteTable(DELETE_TABLE, (err) => {
      t.error(err)
      cb()
    })
  })
}

