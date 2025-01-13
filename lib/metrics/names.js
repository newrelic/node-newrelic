/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const NODEJS = {
  PREFIX: 'Nodejs/'
}

const ALL = 'all'
const POSTGRES_LITERAL = 'Postgres'
const CASSANDRA_LITERAL = 'Cassandra'
const PRISMA_LITERAL = 'Prisma'
const EXPRESS_LITERAL = 'Expressjs'
const OTHER_TRANSACTION_MESSAGE = 'OtherTransaction/Message'

const SUPPORTABILITY = {
  PREFIX: 'Supportability/',
  UNINSTRUMENTED: 'Supportability/Uninstrumented',
  EVENTS: 'Supportability/Events',
  API: 'Supportability/API',
  TRANSACTION_API: 'Supportability/API/Transaction',
  UTILIZATION: 'Supportability/utilization',
  DEPENDENCIES: 'Supportability/InstalledDependencies',
  NODEJS: 'Supportability/Nodejs',
  REGISTRATION: 'Supportability/Registration',
  EVENT_HARVEST: 'Supportability/EventHarvest',
  INFINITE_TRACING: 'Supportability/InfiniteTracing',
  FEATURES: 'Supportability/Features',
  LOGGING: 'Supportability/Logging'
}

const ERRORS = {
  PREFIX: 'Errors/',
  ALL: 'Errors/' + ALL,
  EXPECTED: 'ErrorsExpected/' + ALL,
  WEB: 'Errors/allWeb',
  OTHER: 'Errors/allOther'
}

const EVENTS = {
  WAIT: 'Events/wait',
  DROPPED: SUPPORTABILITY.PREFIX + 'AnalyticsEvents/Discarded',
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
  PREFIX: POSTGRES_LITERAL,
  STATEMENT: DB.STATEMENT + `/${POSTGRES_LITERAL}/`,
  OPERATION: DB.OPERATION + `/${POSTGRES_LITERAL}/`,
  INSTANCE: DB.INSTANCE + `/${POSTGRES_LITERAL}/`
}

const CASSANDRA = {
  PREFIX: CASSANDRA_LITERAL,
  OPERATION: DB.OPERATION + `/${CASSANDRA_LITERAL}/`,
  STATEMENT: DB.STATEMENT + `/${CASSANDRA_LITERAL}/`,
  INSTANCE: DB.INSTANCE + `/${CASSANDRA_LITERAL}/`,
  ALL: DB.PREFIX + `${CASSANDRA_LITERAL}/` + ALL
}

const PRISMA = {
  PREFIX: PRISMA_LITERAL,
  STATEMENT: `${DB.STATEMENT}/${PRISMA_LITERAL}/`,
  OPERATION: `${DB.OPERATION}/${PRISMA_LITERAL}/`,
  INSTANCE: `${DB.INSTANCE}/${PRISMA_LITERAL}/`
}

const EXPRESS = {
  PREFIX: `${EXPRESS_LITERAL}/`,
  MIDDLEWARE: MIDDLEWARE.PREFIX + `${EXPRESS_LITERAL}/`,
  ERROR_HANDLER: MIDDLEWARE.PREFIX + `${EXPRESS_LITERAL}/`
}

const AI = {
  TRACKING_PREFIX: `${SUPPORTABILITY.NODEJS}/ML`,
  STREAMING_DISABLED: `${SUPPORTABILITY.NODEJS}/ML/Streaming/Disabled`,
  EMBEDDING: 'Llm/embedding',
  COMPLETION: 'Llm/completion',
  TOOL: 'Llm/tool',
  CHAIN: 'Llm/chain',
  VECTORSTORE: 'Llm/vectorstore'
}

AI.OPENAI = {
  TRACKING_PREFIX: `${AI.TRACKING_PREFIX}/OpenAI`,
  EMBEDDING: `${AI.EMBEDDING}/OpenAI/create`,
  COMPLETION: `${AI.COMPLETION}/OpenAI/create`
}

AI.BEDROCK = {
  TRACKING_PREFIX: `${AI.TRACKING_PREFIX}/Bedrock`
}

AI.LANGCHAIN = {
  TRACKING_PREFIX: `${AI.TRACKING_PREFIX}/Langchain`,
  EMBEDDING: `${AI.EMBEDDING}/Langchain`,
  COMPLETION: `${AI.COMPLETION}/Langchain`,
  TOOL: `${AI.TOOL}/Langchain`,
  CHAIN: `${AI.CHAIN}/Langchain`,
  VECTORSTORE: `${AI.VECTORSTORE}/Langchain`
}

const RESTIFY = {
  PREFIX: 'Restify/'
}

const HAPI = {
  PREFIX: 'Hapi/',
  MIDDLEWARE: MIDDLEWARE.PREFIX + 'Hapi/'
}

const UTILIZATION = {
  AWS_ERROR: SUPPORTABILITY.UTILIZATION + '/aws/error',
  AZURE_ERROR: SUPPORTABILITY.UTILIZATION + '/azure/error',
  BOOT_ID_ERROR: SUPPORTABILITY.UTILIZATION + '/boot_id/error',
  DOCKER_ERROR: SUPPORTABILITY.UTILIZATION + '/docker/error',
  ECS_CONTAINER_ERROR: SUPPORTABILITY.UTILIZATION + '/ecs/container_id/error',
  GCP_ERROR: SUPPORTABILITY.UTILIZATION + '/gcp/error',
  PCF_ERROR: SUPPORTABILITY.UTILIZATION + '/pcf/error'
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

const EVENT_HARVEST = {
  REPORT_PERIOD: SUPPORTABILITY.EVENT_HARVEST + '/ReportPeriod',
  HARVEST_LIMIT: {
    ANALYTIC: SUPPORTABILITY.EVENT_HARVEST + '/AnalyticEventData/HarvestLimit',
    CUSTOM: SUPPORTABILITY.EVENT_HARVEST + '/CustomEventData/HarvestLimit',
    ERROR: SUPPORTABILITY.EVENT_HARVEST + '/ErrorEventData/HarvestLimit',
    SPAN: SUPPORTABILITY.EVENT_HARVEST + '/SpanEventData/HarvestLimit',
    LOG: SUPPORTABILITY.EVENT_HARVEST + '/LogEventData/HarvestLimit'
  }
}

const DATA_USAGE_PREFIX = `${SUPPORTABILITY.NODEJS}/Collector`
const DATA_USAGE_SUFFIX = 'Output/Bytes'

const DATA_USAGE = {
  SUFFIX: DATA_USAGE_SUFFIX,
  PREFIX: DATA_USAGE_PREFIX,
  COLLECTOR: `${DATA_USAGE_PREFIX}/${DATA_USAGE_SUFFIX}`
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
  MESSAGE: OTHER_TRANSACTION_MESSAGE
}

const MESSAGE_TRANSACTION = {
  PREFIX: OTHER_TRANSACTION_MESSAGE,
  RESPONSE_TIME: OTHER_TRANSACTION_MESSAGE,
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

const SPAN_EVENT_PREFIX = 'SpanEvent/'

const SPAN_EVENTS = {
  SEEN: SUPPORTABILITY.PREFIX + SPAN_EVENT_PREFIX + 'TotalEventsSeen',
  SENT: SUPPORTABILITY.PREFIX + SPAN_EVENT_PREFIX + 'TotalEventsSent',
  DROPPED: SUPPORTABILITY.PREFIX + SPAN_EVENT_PREFIX + 'Discarded',
  LIMIT: SUPPORTABILITY.PREFIX + SPAN_EVENT_PREFIX + 'Limit'
}

const INFINITE_TRACING = {
  SEEN: SUPPORTABILITY.INFINITE_TRACING + '/Span/Seen',
  SENT: SUPPORTABILITY.INFINITE_TRACING + '/Span/Sent',
  DROPPED: SUPPORTABILITY.INFINITE_TRACING + '/Span/Dropped',
  SPAN_RESPONSE_ERROR: SUPPORTABILITY.INFINITE_TRACING + '/Span/Response/Error',
  SPAN_RESPONSE_GRPC_UNIMPLEMENTED: SUPPORTABILITY.INFINITE_TRACING + '/Span/gRPC/UNIMPLEMENTED',
  SPAN_RESPONSE_GRPC_STATUS: SUPPORTABILITY.INFINITE_TRACING + '/Span/gRPC/%s',
  QUEUE_CAPACITY: SUPPORTABILITY.INFINITE_TRACING + '/Span/QueueCapacity',
  QUEUE_SIZE: SUPPORTABILITY.INFINITE_TRACING + '/Span/QueueSize',
  DRAIN_DURATION: SUPPORTABILITY.INFINITE_TRACING + '/Drain/Duration',
  COMPRESSION: `${SUPPORTABILITY.INFINITE_TRACING}/gRPC/Compression`,
  BATCHING: `${SUPPORTABILITY.INFINITE_TRACING}/gRPC/Batching`
}

const FEATURES = {
  ESM: {
    LOADER: `${SUPPORTABILITY.FEATURES}/ESM/Loader`
  },
  CJS: {
    PRELOAD: `${SUPPORTABILITY.FEATURES}/CJS/Preload`,
    REQUIRE: `${SUPPORTABILITY.FEATURES}/CJS/Require`
  },
  SOURCE_MAPS: `${SUPPORTABILITY.FEATURES}/EnableSourceMaps`,
  CERTIFICATES: SUPPORTABILITY.FEATURES + '/Certificates',
  INSTRUMENTATION: {
    ON_REQUIRE: SUPPORTABILITY.FEATURES + '/Instrumentation/OnRequire'
  }
}

const LOGGING_LINES_PREFIX = 'Logging/lines'
const LOGGING_FORWARDING_PREFIX = `${SUPPORTABILITY.LOGGING}/Forwarding`
const LOGGING = {
  LINES: LOGGING_LINES_PREFIX,
  LEVELS: {
    INFO: `${LOGGING_LINES_PREFIX}/INFO`,
    WARN: `${LOGGING_LINES_PREFIX}/WARN`,
    ERROR: `${LOGGING_LINES_PREFIX}/ERROR`,
    FATAL: `${LOGGING_LINES_PREFIX}/FATAL`,
    DEBUG: `${LOGGING_LINES_PREFIX}/DEBUG`,
    TRACE: `${LOGGING_LINES_PREFIX}/TRACE`,
    UNKNOWN: `${LOGGING_LINES_PREFIX}/UNKNOWN`
  },
  LIBS: {
    BUNYAN: `${SUPPORTABILITY.LOGGING}/${NODEJS.PREFIX}bunyan/enabled`,
    PINO: `${SUPPORTABILITY.LOGGING}/${NODEJS.PREFIX}pino/enabled`,
    WINSTON: `${SUPPORTABILITY.LOGGING}/${NODEJS.PREFIX}winston/enabled`
  },
  DROPPED: 'Logging/Forwarding/Dropped',
  SEEN: `${LOGGING_FORWARDING_PREFIX}/Seen`,
  SENT: `${LOGGING_FORWARDING_PREFIX}/Sent`,
  FORWARDING: `${LOGGING_FORWARDING_PREFIX}/${NODEJS.PREFIX}`,
  METRICS: `${SUPPORTABILITY.LOGGING}/Metrics/${NODEJS.PREFIX}`,
  LOCAL_DECORATING: `${SUPPORTABILITY.LOGGING}/LocalDecorating/${NODEJS.PREFIX}`,
  LABELS: `${SUPPORTABILITY.LOGGING}/Labels/${NODEJS.PREFIX}`
}

const KAFKA = {
  PREFIX: `${SUPPORTABILITY.FEATURES}/Instrumentation/kafkajs`
}

module.exports = {
  ACTION_DELIMITER: '/',
  AI,
  ALL,
  APDEX: 'Apdex',
  CASSANDRA,
  CLIENT_APPLICATION: 'ClientApplication',
  CONTROLLER: 'Controller',
  CPU,
  CUSTOM: 'Custom',
  CUSTOM_EVENTS,
  DATA_USAGE,
  DB,
  DISTRIBUTED_TRACE,
  ERRORS,
  EVENTS,
  EVENT_HARVEST,
  EXPRESS,
  EXTERNAL,
  FEATURES,
  FS,
  FUNCTION,
  GC,
  HAPI,
  HTTP: 'HttpDispatcher',
  INFINITE_TRACING,
  KAFKA,
  LOOP,
  LOGGING,
  MEMCACHE,
  MEMORY,
  MESSAGE_TRANSACTION,
  MIDDLEWARE,
  MONGODB,
  MYSQL,
  NODEJS,
  NORMALIZED: 'NormalizedUri',
  OTHER_TRANSACTION,
  POSTGRES,
  PRISMA,
  QUEUETIME: 'WebFrontend/QueueTime',
  REDIS,
  RESTIFY,
  SPAN_EVENTS,
  SUPPORTABILITY,
  TRANSACTION_ERROR,
  TRUNCATED,
  URI: 'Uri',
  UTILIZATION,
  VIEW,
  WEB
}
