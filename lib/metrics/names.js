'use strict';

var ERRORS = {
  PREFIX : 'Errors/',
  ALL    : 'Errors/all',
  WEB    : 'Errors/allWeb'
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
  WEB    : 'Database/all/Web',
  OTHER  : 'Database/all/Other'
};

var EXTERNAL = {
  PREFIX : 'External/',
  ALL    : 'External/all',
  WEB    : 'External/all/Web',
  OTHER  : 'External/all/Other'
};

var FILESYSTEM = {
  READDIR : 'Filesystem/ReadDir'
};

var MEMCACHE = {
  PREFIX : 'MemCache/',
  ALL    : 'MemCache/all',
  WEB    : 'MemCache/allWeb'
};

var MONGODB = {
  PREFIX : 'MongoDB/'
};

var REDIS = {
  PREFIX : 'Redis/',
  ALL    : 'Redis/all',
  WEB    : 'Redis/allWeb'
};

module.exports = {
  URI        : 'Uri',
  NORMALIZED : 'NormalizedUri',
  APDEX      : 'Apdex',
  WEB        : 'WebTransaction',
  HTTP       : 'HttpDispatcher',
  STATUS     : 'StatusCode/',
  ERRORS     : ERRORS,
  EVENTS     : EVENTS,
  MEMORY     : MEMORY,
  VIEW       : VIEW,
  DB         : DB,
  EXTERNAL   : EXTERNAL,
  FILESYSTEM : FILESYSTEM,
  MEMCACHE   : MEMCACHE,
  MONGODB    : MONGODB,
  REDIS      : REDIS
};
