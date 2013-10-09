'use strict';

var path           = require('path')
  , util           = require('util')
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

  var state   = agent.tracer.getState()
    , name    = NAMES.EXTERNAL.PREFIX + hostname + urltils.scrub(request.path)
    , segment = state.getSegment().add(name, recordExternal(hostname, 'http'))
    ;

  if (agent.config.capture_params) {
    var params = urltils.parseParameters(request.path);

    // clear out ignored params
    agent.config.ignored_params.forEach(function (k) { delete params[k]; });

    // don't replace any existing segment or trace parameters, but do add to them
    util._extend(segment.parameters, params);
  }

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
