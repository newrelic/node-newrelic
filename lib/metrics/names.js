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

var EXPRESS = {
  PREFIX : 'Expressjs/'
}

var RESTIFY = {
  PREFIX : 'Restify/'
}

var HAPI = {
  PREFIX : 'Hapi/'
}

module.exports = {
  URI              : 'Uri',
  NORMALIZED       : 'NormalizedUri',
  APDEX            : 'Apdex',
  WEB              : 'WebTransaction',
  BACKGROUND       : 'OtherTransaction',
  HTTP             : 'HttpDispatcher',
  CONTROLLER       : 'Controller',
  CUSTOM           : 'Custom',
  SUPPORTABILITY   : 'Supportability/',
  QUEUETIME        : 'WebFrontend/QueueTime',
  CLIENT_APPLICATION : 'ClientApplication',
  ERRORS           : ERRORS,
  EVENTS           : EVENTS,
  MEMORY           : MEMORY,
  VIEW             : VIEW,
  DB               : DB,
  EXTERNAL         : EXTERNAL,
  MEMCACHE         : MEMCACHE,
  MONGODB          : MONGODB,
  MYSQL            : MYSQL,
  POSTGRES         : POSTGRES,
  CASSANDRA        : CASSANDRA,
  REDIS            : REDIS,
  EXPRESS          : EXPRESS,
  RESTIFY          : RESTIFY,
  HAPI             : HAPI,
  ACTION_DELIMITER : '/'
}
