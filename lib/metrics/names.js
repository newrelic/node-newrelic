'use strict'

var ERRORS = {
  PREFIX : 'Errors/',
  ALL    : 'Errors/all'
}

var EVENTS = {
  WAIT : 'Events/wait'
}

var MEMORY = {
  PHYSICAL : 'Memory/Physical'
}

var VIEW = {
  PREFIX : 'View/',
  RENDER : '/Rendering'
}

var DB = {
  PREFIX    : 'Datastore/',
  STATEMENT : 'Datastore/statement',
  OPERATION : 'Datastore/operation',
  INSTANCE  : 'Datastore/instance',
  ALL       : 'Datastore/all',
  WEB       : 'Datastore/allWeb',
  OTHER     : 'Datastore/allOther'
}

var EXTERNAL = {
  PREFIX : 'External/',
  ALL    : 'External/all',
  WEB    : 'External/allWeb',
  OTHER  : 'External/allOther',
  APP    : 'ExternalApp/',
  TRANSACTION : 'ExternalTransaction/'
}

var MEMCACHE = {
  PREFIX    : 'Memcache',
  OPERATION : DB.OPERATION + '/Memcache/',
  INSTANCE  : DB.INSTANCE  + '/Memcache/'
}

var MONGODB = {
  PREFIX    : 'MongoDB',
  STATEMENT : DB.STATEMENT + '/MongoDB/',
  OPERATION : DB.OPERATION + '/MongoDB/',
  INSTANCE  : DB.INSTANCE  + '/MongoDB/'
}

var MYSQL = {
  PREFIX    : 'MySQL',
  STATEMENT : DB.STATEMENT + '/MySQL/',
  OPERATION : DB.OPERATION + '/MySQL/',
  INSTANCE  : DB.INSTANCE  + '/MySQL/'
}

var REDIS = {
  PREFIX    : 'Redis',
  OPERATION : DB.OPERATION + '/Redis/',
  INSTANCE  : DB.INSTANCE  + '/Redis/'
}

var POSTGRES = {
  PREFIX    : 'Postgres',
  STATEMENT : DB.STATEMENT + '/Postgres/',
  OPERATION : DB.OPERATION + '/Postgres/',
  INSTANCE  : DB.INSTANCE  + '/Postgres/'
}

var CASSANDRA = {
  PREFIX    : 'Cassandra',
  OPERATION : DB.OPERATION + '/Cassandra/',
  INSTANCE  : DB.INSTANCE  + '/Cassandra/'
}

var ORACLE = {
  PREFIX    : 'Oracle',
  STATEMENT : DB.STATEMENT + '/Oracle/',
  OPERATION : DB.OPERATION + '/Oracle/',
  INSTANCE  : DB.INSTANCE  + '/Oracle/'
}

var EXPRESS = {
  PREFIX : 'Expressjs/'
}

var RESTIFY = {
  PREFIX : 'Restify/'
}

var HAPI = {
  PREFIX : 'Hapi/'
}

var SUPPORTABILITY = {
  PREFIX: 'Supportability/',
  UNINSTRUMENTED: 'Supportability/Uninstrumented',
  EVENTS: 'Supportability/Events'
}

var CUSTOM_EVENTS = {
  PREFIX: SUPPORTABILITY.EVENTS + '/Customer/',
  DROPPED: SUPPORTABILITY.EVENTS + '/Customer/Dropped',
  SEEN: SUPPORTABILITY.EVENTS + '/Customer/Seen',
  SENT: SUPPORTABILITY.EVENTS + '/Customer/Sent'
}

module.exports = {
  ACTION_DELIMITER : '/',
  APDEX            : 'Apdex',
  BACKGROUND       : 'OtherTransaction',
  CASSANDRA        : CASSANDRA,
  CLIENT_APPLICATION : 'ClientApplication',
  CONTROLLER       : 'Controller',
  CUSTOM           : 'Custom',
  CUSTOM_EVENTS    : CUSTOM_EVENTS,
  DB               : DB,
  ERRORS           : ERRORS,
  EVENTS           : EVENTS,
  EXPRESS          : EXPRESS,
  EXTERNAL         : EXTERNAL,
  HAPI             : HAPI,
  HTTP             : 'HttpDispatcher',
  MEMCACHE         : MEMCACHE,
  MEMORY           : MEMORY,
  MONGODB          : MONGODB,
  MYSQL            : MYSQL,
  NORMALIZED       : 'NormalizedUri',
  ORACLE           : ORACLE,
  POSTGRES         : POSTGRES,
  QUEUETIME        : 'WebFrontend/QueueTime',
  REDIS            : REDIS,
  RESTIFY          : RESTIFY,
  SUPPORTABILITY   : SUPPORTABILITY,
  URI              : 'Uri',
  VIEW             : VIEW,
  WEB              : 'WebTransaction'
}
