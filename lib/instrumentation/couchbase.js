'use strict'
var shimmer = require('../shimmer')
var ParsedStatement = require('../db/parsed-statement')
var COUCHBASE = require('../metrics/names').COUCHBASE

var BUCKET_OPERATIONS = [
  'get',
  'query',
  'getMulti',
  'getAndTouch',
  'getAndLock',
  'getReplica',
  'touch',
  'unlock',
  'remove',
  'upsert',
  'insert',
  'replace',
  'append',
  'prepend',
  'counter'
]

module.exports = function initialize(agent, couchbase) {
  var tracer = agent.tracer
  var bucketInstrumented = false

  if (couchbase.Cluster && couchbase.Cluster.name === 'MockCluster') {
    return
  }

  // Couchbase don't export Bucket, can only instrument this once a 
  // a call to Cluster.openBucket is called for the first time.
  shimmer.wrapMethod(
    couchbase && couchbase.Cluster && couchbase.Cluster.prototype,
    'couchbase.Cluster.prototype',
    'openBucket',
    function wrapOpenBucket(original) {
      return function wrappedOpenBucket() {
        var bucket = original.apply(this, arguments)
        instrumentBucket(bucket)
        return bucket
      }
    }
  )

  function instrumentBucket(bucket) {
    if (bucketInstrumented) {
      return
    }
    bucketInstrumented = true
    
    var bucketProto = Object.getPrototypeOf(bucket)
    BUCKET_OPERATIONS.forEach(function forEachOperations(operationName) {
      shimmer.wrapMethod(
        bucketProto,
        'couchbase.Bucket.prototype',
        operationName,
        function wrapBucketOperation(original) {
          return tracer.wrapFunction(
            COUCHBASE.OPERATION + 'Unknown/' + operationName,
            null,
            original,
            bucketOperationWrapper(operationName)
          )
        }
      )
    }, this)
  }

  function bucketOperationWrapper(operationName) {
    return function operationWrap(segment, args, bind) {
      var bucketName = this._name
      var statement = new ParsedStatement(COUCHBASE.PREFIX, operationName, bucketName)
      
      segment.name = COUCHBASE.STATEMENT + bucketName + '/' + operationName
      segment.transaction.addRecorder(statement.recordMetrics.bind(statement, segment))

      var callback = args[args.length - 1]
      args[args.length - 1] = bind(callback)
      
      return args
    }
  }
}
