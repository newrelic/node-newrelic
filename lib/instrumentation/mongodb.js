'use strict'

const semver = require('semver')

// XXX: When this instrumentation is modularized, update this thread
// with a cautionary note:
// https://discuss.newrelic.com/t/feature-idea-using-mongoose-cursors-memory-leaking-very-quickly/49270/14
//
// This instrumentation is deep linked against in the mongoose instrumentation
// snippet.  The snippet will break once this file is moved from this
// location.

// legacy endpoint enumerations
const DB_OPS = [
  'addUser',
  'authenticate',
  'collection',
  'collectionNames',
  'collections',
  'command',
  'createCollection',
  'createIndex',
  'cursorInfo',
  'dereference',
  'dropCollection',
  'dropDatabase',
  'dropIndex',
  'ensureIndex',
  'eval',
  'executeDbAdminCommand',
  'indexInformation',
  'logout',
  'open',
  'reIndex',
  'removeUser',
  'renameCollection',
  'stats',
  '_executeInsertCommand',
  '_executeQueryCommand'
]

const COLLECTION_OPS = [
  'aggregate',
  'bulkWrite',
  'count',
  'createIndex',
  'deleteMany',
  'deleteOne',
  'distinct',
  'drop',
  'dropAllIndexes',
  'dropIndex',
  'ensureIndex',
  'findAndModify',
  'findAndRemove',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'geoHaystackSearch',
  'geoNear',
  'group',
  'indexes',
  'indexExists',
  'indexInformation',
  'insert',
  'insertMany',
  'insertOne',
  'isCapped',
  'mapReduce',
  'options',
  'parallelCollectionScan',
  'reIndex',
  'remove',
  'rename',
  'replaceOne',
  'save',
  'stats',
  'update',
  'updateMany',
  'updateOne'
]

const GRID_OPS = [
  'put',
  'get',
  'delete'
]

const CURSOR_OPS = [
  'nextObject',
  'next',
  'toArray',
  'count',
  'explain'
]

module.exports = initialize

function initialize(agent, mongodb, moduleName, shim) {
  if (!mongodb) return

  shim.setDatastore(shim.MONGODB)
  shim.setParser(function mongoQueryParser(operation) {
    let collection = this.collectionName || 'unknown'
    if (this.collection && this.collection.collectionName) {
      collection = this.collection.collectionName
    } else if (this.s && this.s.name) {
      collection = this.s.name
    } else if (this.ns) {
      collection = this.ns.split(/\./)[1] || collection
    }

    return {operation, collection}
  })

  const mongoVersion = shim.require('./package.json').version
  if (semver.satisfies(mongoVersion, '>=3.0.6') && mongodb.instrument) {
    instrument306(shim, mongodb)
  } else if (mongodb.instrument) {
    instrumentInstrument(shim, mongodb)
  } else {
    instrumentLegacy(shim, mongodb)
  }
}

function instrument306(shim, mongodb) {
  const instrumenter = mongodb.instrument(Object.create(null), () => {})
  captureAttributesOnStarted(shim, instrumenter)
  instrumentLegacy(shim, mongodb)

  if (shim.isFunction(instrumenter.uninstrument)) {
    shim.agent.once('unload', function uninstrumentMongo() {
      instrumenter.uninstrument()
    })
  }
}

function instrumentInstrument(shim, mongodb) {
  const recordDesc = {
    'Gridstore': {isQuery: false, makeDesc: function makeGridDesc(opName) {
      return {name:'GridFS-' + opName, callback: shim.LAST}
    }},
    'OrderedBulkOperation': {isQuery: true, makeDesc: makeQueryDescFunc},
    'UnorderedBulkOperation': {isQuery: true, makeDesc: makeQueryDescFunc},
    'CommandCursor': {isQuery: true, makeDesc: makeQueryDescFunc},
    'AggregationCursor': {isQuery: true, makeDesc: makeQueryDescFunc},
    'Cursor': {isQuery: true, makeDesc: makeQueryDescFunc},
    'Collection': {isQuery: true, makeDesc: makeQueryDescFunc},
    'Db': {isQuery: false, makeDesc: function makeDbDesc() {
      return {callback: shim.LAST}
    }}
  }

  // instrument using the apm api
  const instrumenter = mongodb.instrument(Object.create(null), instrumentModules)
  captureAttributesOnStarted(shim, instrumenter)

  function instrumentModules(err, instrumentations) {
    if (err) {
      shim.logger
        .trace('Unable to instrument mongo using the apm api due to error: %s', err)
      // fallback to legacy instrumentation?
      return
    }
    instrumentations.forEach(instrumentModule)
  }

  function instrumentModule(module) {
    var object = module.obj
    var instrumentations = module.instrumentations
    for (var i = 0; i < instrumentations.length; i++) {
      applyInstrumentation(module.name, object, instrumentations[i])
    }
  }

  function applyInstrumentation(objectName, object, instrumentation) {
    var methods = instrumentation.methods
    var methodOptions = instrumentation.options
    if (methodOptions.callback) {
      for (var j = 0; j < methods.length; j++) {
        var method = methods[j]

        var isQuery = recordDesc[objectName].isQuery
        var makeDescFunc = recordDesc[objectName].makeDesc
        var proto = object.prototype
        if (isQuery) {
          shim.recordQuery(proto, method, makeDescFunc(shim, method))
        } else if (isQuery === false) { // could be unset
          shim.recordOperation(proto, method, makeDescFunc(shim, method))
        } else {
          shim.logger.trace('No wrapping method found for %s', objectName)
        }
      }
    }

    // the cursor object implements Readable stream and internally calls nextObject on
    // each read, in which case we do not want to record each nextObject() call
    if (/Cursor$/.test(objectName)) {
      shim.recordOperation(object.prototype, 'pipe')
    }
  }
}

function captureAttributesOnStarted(shim, instrumenter) {
  instrumenter.on('started', function onMongoEventStarted(evnt) {
    // This assumes that this `started` event is fired _after_ our wrapper
    // starts and creates the segment. We perform a check of the segment name
    // out of an excess of caution.
    const connId = evnt.connectionId
    if (connId) {
      // Mongo sticks the path to the domain socket in the "host" slot, but we
      // want it in the "port", so if we have a domain socket we need to change
      // the order of our parameters.
      if (typeof connId === 'string') {
        const parts = connId.split(':')
        if (parts.length && parts[0][0] === '/') {
          shim.captureInstanceAttributes('localhost', parts[0], evnt.databaseName)
        } else {
          shim.captureInstanceAttributes(parts[0], parts[1], evnt.databaseName)
        }
      } else if (connId.domainSocket) {
        shim.captureInstanceAttributes('localhost', connId.host, evnt.databaseName)
      } else {
        shim.captureInstanceAttributes(connId.host, connId.port, evnt.databaseName)
      }
    }
  })
}

function instrumentLegacy(shim, mongodb) {
  instrumentCursor(mongodb.Cursor)
  instrumentCursor(shim.require('./lib/aggregation_cursor'))
  instrumentCursor(shim.require('./lib/command_cursor'))

  if (mongodb.Collection && mongodb.Collection.prototype) {
    const proto = mongodb.Collection.prototype
    for (let i = 0; i < COLLECTION_OPS.length; i++) {
      shim.recordQuery(
        proto,
        COLLECTION_OPS[i],
        makeQueryDescFunc(shim, COLLECTION_OPS[i])
      )
    }
  }

  if (mongodb.Grid && mongodb.Grid.prototype) {
    const proto = mongodb.Grid.prototype
    for (let i = 0; i < CURSOR_OPS.length; i++) {
      shim.recordOperation(proto, GRID_OPS[i],
        {name:'GridFS-' + GRID_OPS[i], callback: shim.LAST})
    }
  }

  if (mongodb.Db && mongodb.Db.prototype) {
    const proto = mongodb.Db.prototype
    shim.recordOperation(proto, DB_OPS, {callback: shim.LAST})
    shim.recordOperation(mongodb.Db, 'connect', {callback: shim.LAST})
  }

  function instrumentCursor(Cursor) {
    if (Cursor && Cursor.prototype) {
      const proto = Cursor.prototype
      for (let i = 0; i < CURSOR_OPS.length; i++) {
        shim.recordQuery(proto, CURSOR_OPS[i], makeQueryDescFunc(shim, CURSOR_OPS[i]))
      }

      shim.recordQuery(proto, 'each', makeQueryDescFunc(shim, 'each'))
      shim.recordOperation(proto, 'pipe')
    }
  }
}

function makeQueryDescFunc(shim, methodName) {
  if (methodName === 'each') {
    return function eachDescFunc() {
      const parameters = getInstanceAttributeParameters(shim, this)
      return {query: methodName, parameters, rowCallback: shim.LAST}
    }
  }

  return function queryDescFunc() {
    // segment name does not actually use query string
    // method name is set as query so the query parser has access to the op name
    const parameters = getInstanceAttributeParameters(shim, this)
    return {query: methodName, parameters, callback: shim.LAST}
  }
}

function getInstanceAttributeParameters(shim, obj) {
  if (obj.db && obj.db.serverConfig) {
    shim.logger.trace('Adding datastore instance attributes from obj.db.serverConfig')
    const serverConfig = obj.db.serverConfig
    const db = serverConfig.db || serverConfig.dbInstance
    return doCapture(serverConfig, db && db.databaseName)
  } else if (obj.s && obj.s.db && obj.s.topology) {
    shim.logger.trace(
      'Adding datastore instance attributes from obj.s.db + obj.s.topology'
    )
    const databaseName = obj.s.db.databaseName || null
    const topology = obj.s.topology
    if (topology.s && topology.s.options) {
      return doCapture(topology.s.options, databaseName)
    }
  }

  shim.logger.trace('Could not find datastore instance attributes.')
  return {
    host: null,
    port_path_or_id: null,
    database_name: null
  }

  function doCapture(conf, database) {
    let host = conf.host
    let port = conf.port

    // If using a domain socket, mongo stores the path as the host name, but we
    // pass it through the port value.
    if (
      (conf.socketOptions && conf.socketOptions.domainSocket) ||
      /\.sock$/.test(host)
    ) {
      port = host
      host = 'localhost'
    }

    return {
      host: host,
      port_path_or_id: port,
      database_name: database
    }
  }
}
