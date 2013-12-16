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
  if (!hostname) throw new Error("hostname must be defined!");
  if (!port || port < 1) throw new Error("port must be defined!");
  if (port && port !== DEFAULT_PORT) hostname = hostname + ':' + port;

  var transaction = agent.tracer.getTransaction()
    , name        = NAMES.EXTERNAL.PREFIX + hostname + urltils.scrub(request.path)
    , segment     = agent.tracer.addSegment(name, recordExternal(hostname, 'http'))
    ;

  var params = urltils.parseParameters(request.path);
  urltils.copyParameters(agent.config, params, segment.parameters);

  // may trace errors multiple times, make that the error tracer's problem
  request.once('error', function (error) {
    agent.errors.add(transaction, error);
    segment.end();
  });

  request.on('response', function (res) {
    res.once('end', segment.end.bind(segment));
  });

  // ensure listeners are evaluated in correct transactional scope
  agent.tracer.bindEmitter(request);
}

module.exports = instrumentOutbound;
