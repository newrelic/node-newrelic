'use strict'

// legacy endpoint enumerations
var DB_OPS = [
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

var COLLECTION_OPS = [
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

var GRID_OPS = [
  'put',
  'get',
  'delete'
]

var CURSOR_OPS = [
  'nextObject',
  'next',
  'toArray',
  'count',
  'explain'
]

module.exports = initialize

function initialize(agent, mongodb, moduleName, shim) {
  if (!mongodb) return
  var recordDesc = {
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

  shim.setDatastore(shim.MONGODB)
  shim.setParser(function mongoQueryParser(operation) {
    var collection = this.collectionName || 'unknown'
    if (this.collection && this.collection.collectionName) {
      collection = this.collection.collectionName
    } else if (this.s && this.s.name) {
      collection = this.s.name
    } else if (this.ns) {
      collection = this.ns.split(/\./)[1] || collection
    }

    return {
      operation: operation,
      model: collection
    }
  })

  // instrument using the apm api
  if (mongodb.instrument) {
    mongodb.instrument({}, instrumentModules)
    return
  }

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
          shim.recordQuery(proto, method, makeDescFunc(method))
        } else if (isQuery === false) { // could be unset
          shim.recordOperation(proto, method, makeDescFunc(method))
        } else {
          shim.logger.trace('No wrapping method found for %s', objectName)
        }
      }
    }
  }

  function makeQueryDescFunc(methodName) {
    return function queryDescFunc() {
      var extras = {}
      // capture configuration information if available
      if (this.db && this.db.serverConfig) {
        extras.host = this.db.serverConfig.host
        extras.port = this.db.serverConfig.port
      } else if (this.s && this.s.topology) {
        extras.host = this.s.topology.host
        extras.port = this.s.topology.port
      }

      // the callback for 'each' is called for each item in the results so we don't create
      // child segments in this case
      // TODO create an aggregate segment in the case of 'each'
      var callback = shim.LAST
      if (methodName === 'each') {
        callback = function eachCallbackBinder(shim, each, eachName, segment, args) {
          var cb = args[args.length - 1]
          args[args.length - 1] = shim.bindSegment(cb, segment)
        }
      }

      // segment name does not actually use query string
      // method name is set as query so the query parser has access to the op name
      return {query: methodName, callback: callback, extras: extras}
    }
  }

  // fallback to legacy enumerations
  if (mongodb.Cursor && mongodb.Cursor.prototype) {
    var proto = mongodb.Cursor.prototype
    for (var i = 0; i < CURSOR_OPS.length; i++) {
      shim.recordQuery(proto, CURSOR_OPS[i], makeQueryDescFunc(CURSOR_OPS[i]))
    }

    shim.recordQuery(proto, 'each', makeQueryDescFunc('each'))
  }

  if (mongodb.Collection && mongodb.Collection.prototype) {
    var proto = mongodb.Collection.prototype
    for (var i = 0; i < COLLECTION_OPS.length; i++) {
      shim.recordQuery(proto, COLLECTION_OPS[i], makeQueryDescFunc(COLLECTION_OPS[i]))
    }
  }

  if (mongodb.Grid && mongodb.Grid.prototype) {
    var proto = mongodb.Grid.prototype
    for (var i = 0; i < CURSOR_OPS.length; i++) {
      shim.recordOperation(proto, GRID_OPS[i],
        {name:'GridFS-' + GRID_OPS[i], callback: shim.LAST})
    }
  }

  if (mongodb.Db && mongodb.Db.prototype) {
    var proto = mongodb.Db.prototype
    shim.recordOperation(proto, DB_OPS, {callback: shim.LAST})
    shim.recordOperation(mongodb.Db, 'connect', {callback: shim.LAST})
  }
}
