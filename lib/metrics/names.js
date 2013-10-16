'use strict';

var ERRORS = {
  PREFIX : 'Errors/',
  ALL    : 'Errors/all'
};

var EVENTS = {
  WAIT : 'Events/wait'
};

var MEMORY = {
  PHYSICAL : 'Memory/Physical'
};

var VIEW = {
  PREFIX : 'View/',
  RENDER : '/Rendering'
};

var DB = {
  PREFIX    : 'Datastore/',
  STATEMENT : 'Datastore/statement',
  OPERATION : 'Datastore/operation',
  INSTANCE  : 'Datastore/instance',
  ALL       : 'Datastore/all',
  WEB       : 'Datastore/allWeb',
  OTHER     : 'Datastore/allOther'
};

var EXTERNAL = {
  PREFIX : 'External/',
  ALL    : 'External/all',
  WEB    : 'External/allWeb',
  OTHER  : 'External/allOther'
};

var FILESYSTEM = {
  READDIR : 'Filesystem/ReadDir'
};

var MEMCACHE = {
  PREFIX    : 'Memcache',
  OPERATION : DB.OPERATION + '/Memcache/',
  INSTANCE  : DB.INSTANCE  + '/Memcache/'
};

var MONGODB = {
  PREFIX    : 'MongoDB',
  STATEMENT : DB.STATEMENT + '/MongoDB/',
  OPERATION : DB.OPERATION + '/MongoDB/',
  INSTANCE  : DB.INSTANCE  + '/MongoDB/'
};

var MYSQL = {
  PREFIX    : 'MySQL',
  STATEMENT : DB.STATEMENT + '/MySQL/',
  OPERATION : DB.OPERATION + '/MySQL/',
  INSTANCE  : DB.INSTANCE  + '/MySQL/'
};

var REDIS = {
  PREFIX    : 'Redis',
  OPERATION : DB.OPERATION + '/Redis/',
  INSTANCE  : DB.INSTANCE  + '/Redis/'
};

var EXPRESS = {
  PREFIX : 'Expressjs/'
};

var RESTIFY = {
  PREFIX : 'Restify/'
};

module.exports = {
  URI              : 'Uri',
  NORMALIZED       : 'NormalizedUri',
  APDEX            : 'Apdex',
  WEB              : 'WebTransaction',
  HTTP             : 'HttpDispatcher',
  CONTROLLER       : 'Controller',
  CUSTOM           : 'Custom',
  SUPPORTABILITY   : 'Supportability/',
  ERRORS           : ERRORS,
  EVENTS           : EVENTS,
  MEMORY           : MEMORY,
  VIEW             : VIEW,
  DB               : DB,
  EXTERNAL         : EXTERNAL,
  FILESYSTEM       : FILESYSTEM,
  MEMCACHE         : MEMCACHE,
  MONGODB          : MONGODB,
  MYSQL            : MYSQL,
  REDIS            : REDIS,
  EXPRESS          : EXPRESS,
  RESTIFY          : RESTIFY,
  ACTION_DELIMITER : '/'
};
