'use strict'

const NODEJS = {
  PREFIX: 'Nodejs/'
}

const ALL = 'all'

const SUPPORTABILITY = {
  PREFIX: 'Supportability/',
  UNINSTRUMENTED: 'Supportability/Uninstrumented',
  EVENTS: 'Supportability/Events',
  API: 'Supportability/API',
  UTILIZATION: 'Supportability/utilization',
  DEPENDENCIES: 'Supportability/InstalledDependencies',
  NODEJS: 'Supportability/Nodejs'
}

const ERRORS = {
  PREFIX: 'Errors/',
  ALL: 'Errors/' + ALL,
  WEB: 'Errors/allWeb',
  OTHER: 'Errors/allOther'
}

const EVENTS = {
  WAIT: 'Events/wait',
  DISCARDED: SUPPORTABILITY.PREFIX + 'AnalyticsEvents/Discarded',
  SEEN: SUPPORTABILITY.PREFIX + 'AnalyticsEvents/TotalEventsSeen',
  SENT: SUPPORTABILITY.PREFIX + 'AnalyticsEvents/TotalEventsSent'
}

const MEMORY = {
  PHYSICAL: 'Memory/Physical',
  FREE_HEAP: 'Memory/Heap/Free',
  USED_HEAP: 'Memory/Heap/Used',
  MAX_HEAP: 'Memory/Heap/Max',
  USED_NONHEAP: 'Memory/NonHeap/Used'
}

const CPU = {
  SYSTEM_TIME: 'CPU/System Time',
  SYSTEM_UTILIZATION: 'CPU/System/Utilization',
  USER_TIME: 'CPU/User Time',
  USER_UTILIZATION: 'CPU/User/Utilization'
}

const GC = {
  PREFIX: 'GC/',
  PAUSE_TIME: 'GC/System/Pauses'
}

const VIEW = {
  PREFIX: 'View/',
  RENDER: '/Rendering'
}

const LOOP = {
  PREFIX: NODEJS.PREFIX + 'EventLoop/',
  USAGE: NODEJS.PREFIX + 'EventLoop/CPU/Usage'
}

const DB = {
  PREFIX: 'Datastore/',
  STATEMENT: 'Datastore/statement',
  OPERATION: 'Datastore/operation',
  INSTANCE: 'Datastore/instance',
  ALL: 'Datastore/' + ALL,
  WEB: 'allWeb',
  OTHER: 'allOther'
}

const EXTERNAL = {
  PREFIX: 'External/',
  ALL: 'External/' + ALL,
  WEB: 'External/allWeb',
  OTHER: 'External/allOther',
  APP: 'ExternalApp/',
  TRANSACTION: 'ExternalTransaction/'
}

const FUNCTION = {
  PREFIX: 'Function/'
}

const MIDDLEWARE = {
  PREFIX: NODEJS.PREFIX + 'Middleware/'
}

const FS = {
  PREFIX: 'Filesystem/'
}

const MEMCACHE = {
  PREFIX: 'Memcache',
  OPERATION: DB.OPERATION + '/Memcache/',
  INSTANCE: DB.INSTANCE + '/Memcache/',
  ALL: DB.PREFIX + 'Memcache/' + ALL
}

const MONGODB = {
  PREFIX: 'MongoDB',
  STATEMENT: DB.STATEMENT + '/MongoDB/',
  OPERATION: DB.OPERATION + '/MongoDB/',
  INSTANCE: DB.INSTANCE + '/MongoDB/'
}

const MYSQL = {
  PREFIX: 'MySQL',
  STATEMENT: DB.STATEMENT + '/MySQL/',
  OPERATION: DB.OPERATION + '/MySQL/',
  INSTANCE: DB.INSTANCE + '/MySQL/'
}

const REDIS = {
  PREFIX: 'Redis',
  OPERATION: DB.OPERATION + '/Redis/',
  INSTANCE: DB.INSTANCE + '/Redis/',
  ALL: DB.PREFIX + 'Redis/' + ALL
}

const POSTGRES = {
  PREFIX: 'Postgres',
  STATEMENT: DB.STATEMENT + '/Postgres/',
  OPERATION: DB.OPERATION + '/Postgres/',
  INSTANCE: DB.INSTANCE + '/Postgres/'
}

const CASSANDRA = {
  PREFIX: 'Cassandra',
  OPERATION: DB.OPERATION + '/Cassandra/',
  STATEMENT: DB.STATEMENT + '/Cassandra/',
  INSTANCE: DB.INSTANCE + '/Cassandra/',
  ALL: DB.PREFIX + 'Cassandra/' + ALL

}

const ORACLE = {
  PREFIX: 'Oracle',
  STATEMENT: DB.STATEMENT + '/Oracle/',
  OPERATION: DB.OPERATION + '/Oracle/',
  INSTANCE: DB.INSTANCE + '/Oracle/'
}

const EXPRESS = {
  PREFIX: 'Expressjs/',
  MIDDLEWARE: MIDDLEWARE.PREFIX + 'Expressjs/',
  ERROR_HANDLER: MIDDLEWARE.PREFIX + 'Expressjs/'
}

const RESTIFY = {
  PREFIX: 'Restify/'
}

const HAPI = {
  PREFIX: 'Hapi/',
  MIDDLEWARE: MIDDLEWARE.PREFIX + 'Hapi/',
}

const UTILIZATION = {
  AWS_ERROR: SUPPORTABILITY.UTILIZATION + '/aws/error',
  PCF_ERROR: SUPPORTABILITY.UTILIZATION + '/pcf/error',
  AZURE_ERROR: SUPPORTABILITY.UTILIZATION + '/azure/error',
  GCP_ERROR: SUPPORTABILITY.UTILIZATION + '/gcp/error',
  DOCKER_ERROR: SUPPORTABILITY.UTILIZATION + '/docker/error',
  BOOT_ID_ERROR: SUPPORTABILITY.UTILIZATION + '/boot_id/error'
}


const CUSTOM_EVENTS = {
  PREFIX: SUPPORTABILITY.EVENTS + '/Customer/',
  DROPPED: SUPPORTABILITY.EVENTS + '/Customer/Dropped',
  SEEN: SUPPORTABILITY.EVENTS + '/Customer/Seen',
  SENT: SUPPORTABILITY.EVENTS + '/Customer/Sent',
  TOO_LARGE: SUPPORTABILITY.EVENTS + '/Customer/TooLarge',
  FAILED: SUPPORTABILITY.EVENTS + '/Customer/FailedToSend'
}

const TRANSACTION_ERROR = {
  DROPPED: SUPPORTABILITY.EVENTS + '/TransactionError/Dropped',
  SEEN: SUPPORTABILITY.EVENTS + '/TransactionError/Seen',
  SENT: SUPPORTABILITY.EVENTS + '/TransactionError/Sent'
}

const WEB = {
  RESPONSE_TIME: 'WebTransaction',
  FRAMEWORK_PREFIX: 'WebFrameworkUri',
  TOTAL_TIME: 'WebTransactionTotalTime'
}

const OTHER_TRANSACTION = {
  PREFIX: 'OtherTransaction',
  RESPONSE_TIME: 'OtherTransaction',
  TOTAL_TIME: 'OtherTransactionTotalTime',
  MESSAGE: 'OtherTransaction/Message'
}

const MESSAGE_TRANSACTION = {
  PREFIX: 'OtherTransaction/Message',
  RESPONSE_TIME: 'OtherTransaction/Message',
  TOTAL_TIME: 'OtherTransactionTotalTime/Message'
}

const TRUNCATED = {
  PREFIX: 'Truncated/'
}

const DISTRIBUTED_TRACE = {
  DURATION: 'DurationByCaller',
  ERRORS: 'ErrorsByCaller',
  TRANSPORT: 'TransportDuration'
}

const SPAN_EVENTS = {
  SEEN: SUPPORTABILITY.PREFIX + 'SpanEvent/TotalEventsSeen',
  SENT: SUPPORTABILITY.PREFIX + 'SpanEvent/TotalEventsSent',
  DISCARDED: SUPPORTABILITY.PREFIX + 'SpanEvent/Discarded'
}

module.exports = {
  ACTION_DELIMITER: '/',
  ALL: ALL,
  APDEX: 'Apdex',
  CASSANDRA: CASSANDRA,
  CLIENT_APPLICATION: 'ClientApplication',
  CONTROLLER: 'Controller',
  CPU: CPU,
  GC: GC,
  CUSTOM: 'Custom',
  CUSTOM_EVENTS: CUSTOM_EVENTS,
  DISTRIBUTED_TRACE,
  DB: DB,
  ERRORS: ERRORS,
  EVENTS: EVENTS,
  EXPRESS: EXPRESS,
  EXTERNAL: EXTERNAL,
  FS: FS,
  FUNCTION: FUNCTION,
  HAPI: HAPI,
  HTTP: 'HttpDispatcher',
  LOOP: LOOP,
  MEMCACHE: MEMCACHE,
  MEMORY: MEMORY,
  MESSAGE_TRANSACTION: MESSAGE_TRANSACTION,
  MIDDLEWARE: MIDDLEWARE,
  MONGODB: MONGODB,
  MYSQL: MYSQL,
  NORMALIZED: 'NormalizedUri',
  NODEJS: NODEJS,
  ORACLE: ORACLE,
  OTHER_TRANSACTION: OTHER_TRANSACTION,
  POSTGRES: POSTGRES,
  QUEUETIME: 'WebFrontend/QueueTime',
  REDIS: REDIS,
  RESTIFY: RESTIFY,
  SPAN_EVENTS: SPAN_EVENTS,
  SUPPORTABILITY: SUPPORTABILITY,
  TRANSACTION_ERROR: TRANSACTION_ERROR,
  TRUNCATED: TRUNCATED,
  URI: 'Uri',
  UTILIZATION: UTILIZATION,
  VIEW: VIEW,
  WEB: WEB
}
