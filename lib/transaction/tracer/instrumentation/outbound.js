'use strict';

var path           = require('path')
  , recordExternal = require(path.join(__dirname, '..', '..', '..', 'metrics',
                                       'recorders', 'http_external.js'))
  , NAMES          = require(path.join(__dirname, '..', '..', '..', 
                                       'metrics', 'names.js'))
  , urltils        = require(path.join(__dirname, '..', '..', '..', 'util', 'urltils.js'))
  ;

var DEFAULT_PORT = 80;

function instrumentOutbound(agent, request, hostname, port) {
  if (!hostname) throw new Error('Hostname Must be Defined');
  if (!port || port < 1) throw new Error('Port Must be Defined');
  if (port && port !== DEFAULT_PORT) hostname = hostname + ':' + port;

  var state   = agent.tracer.getState()
    , name    = NAMES.EXTERNAL.PREFIX + hostname + urltils.scrub(request.path)
    , segment = state.getSegment().add(name, recordExternal(hostname, 'http'))
    ;

  // may trace errors multiple times, make that the error tracer's problem
  request.once('error', function (error) {
    agent.errors.add(state.getTransaction(), error);
    segment.end();
  });

  request.on('response', function (res) {
    res.once('end', segment.end.bind(segment));
  });

  // ensure listeners are evaluated in correct transactional scope
  agent.tracer.bindEmitter(request);

  state.setSegment(segment);
}

module.exports = instrumentOutbound;
