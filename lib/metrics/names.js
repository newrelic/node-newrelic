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
  PREFIX : 'Database/',
  ALL    : 'Database/all',
  WEB    : 'Database/allWeb',
  OTHER  : 'Database/allOther'
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
  PREFIX : 'Memcache/',
  ALL    : 'Memcache/all',
  WEB    : 'Memcache/allWeb',
  OTHER  : 'Memcache/allOther'
};

var MONGODB = {
  PREFIX : 'MongoDB/'
};

var REDIS = {
  PREFIX : 'Redis/',
  ALL    : 'Redis/all',
  WEB    : 'Redis/allWeb',
  OTHER  : 'Redis/allOther'
};

module.exports = {
  URI            : 'Uri',
  NORMALIZED     : 'NormalizedUri',
  APDEX          : 'Apdex',
  WEB            : 'WebTransaction',
  HTTP           : 'HttpDispatcher',
  STATUS         : 'StatusCode/',
  SUPPORTABILITY : 'Supportability/',
  ERRORS         : ERRORS,
  EVENTS         : EVENTS,
  MEMORY         : MEMORY,
  VIEW           : VIEW,
  DB             : DB,
  EXTERNAL       : EXTERNAL,
  FILESYSTEM     : FILESYSTEM,
  MEMCACHE       : MEMCACHE,
  MONGODB        : MONGODB,
  REDIS          : REDIS
};
