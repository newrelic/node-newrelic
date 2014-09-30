'use strict';

var recordExternal = require('../../../metrics/recorders/http_external.js')
  , NAMES          = require('../../../metrics/names.js')
  , urltils        = require('../../../util/urltils.js')
  , hashes         = require('../../../util/hashes')
  , logger         = require('../../../logger').child({component : 'outbound'})
  ;

var DEFAULT_PORT = 80;

function instrumentOutbound(agent, request, hostname, port) {
  if (!hostname) throw new Error("hostname must be defined!");
  if (!port || port < 1) throw new Error("port must be defined!");
  if (port && port !== DEFAULT_PORT) hostname = hostname + ':' + port;

  var transaction = agent.tracer.getTransaction();
  var name        = NAMES.EXTERNAL.PREFIX + hostname + urltils.scrub(request.path);
  var segment     = agent.tracer.addSegment(name, recordExternal(hostname, 'http'));


  var params = urltils.parseParameters(request.path);
  urltils.copyParameters(agent.config, params, segment.parameters);

  // may trace errors multiple times, make that the error tracer's problem
  request.once('error', function handle_error(error) {
    agent.errors.add(transaction, error);
    segment.end();
  });

  // Pop off the listeners so we can make sure our response handler happens
  // first. This is to prevent a case where the transaction ends before our
  // response handler has had a chance to pull data it needs for segment
  // metrics.
  var existingListeners = request.listeners('response').slice();
  request.removeAllListeners('response');

  request.on('response', function handle_response(res) {
    // FLAG: cat
    if (agent.config.feature_flag.cat) {
      pullCatHeaders(agent, segment, hostname, res);
    }
    res.once('end', segment.end.bind(segment));

  });

  // Push the listeners we popped off back onto the event. See above for
  // explaination of why.
  for (var i = 0; i < existingListeners.length; i++) {
    request.on('response', existingListeners[i]);
  }

  // ensure listeners are evaluated in correct transactional scope
  agent.tracer.bindEmitter(request);
}

// TODO: cat refactor this so it takes more minimal arguments so it is more
// easily tested.
// TODO: cat-test this should be exported and unit tested, there is no reason to
// send this to only integration test land.
function pullCatHeaders(agent, segment, host, res) {
  if (agent.config.encoding_key && agent.config.trusted_account_ids) {
    // is our downstream request CAT-aware?
    var obfAppData = res.headers['x-newrelic-app-data'];
    if (obfAppData) {
      var appData = null;
      try {
        appData = JSON.parse(hashes.deobfuscateNameUsingKey(obfAppData,
                                                            agent.config.encoding_key));
      } catch (e) {
        logger.warn('Got an unparsable CAT header x-newrelic-app-data: %s', obfAppData);
        return;
      }
      // Make sure it is a trusted account
      if (appData.length && typeof appData[0] === 'string') {
        var accountId = appData[0].split('#')[0];
        accountId = parseInt(accountId, 10);
        if (agent.config.trusted_account_ids.indexOf(accountId) !== -1) {
          segment.catId = appData[0];
          segment.catTransaction = appData[1];
          segment.name = NAMES.EXTERNAL.TRANSACTION + host + '/' + segment.catId + '/' + segment.catTransaction;
          if (appData.length >= 6) {
            segment.parameters.transaction_guid = appData[5];
          }
        }
      }
    }
  }
}

module.exports = instrumentOutbound;
