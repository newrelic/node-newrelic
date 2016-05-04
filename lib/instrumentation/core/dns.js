'use strict'

var wrap = require('../../shimmer').wrapMethod

module.exports = initialize

function initialize(agent, dns) {
  var methods = [
    'lookup',
    'resolve',
    'resolve4',
    'resolve6',
    'resolveCname',
    'resolveMx',
    'resolveNaptr',
    'resolveNs',
    'resolvePtr',
    'resolveSrv',
    'resolveTxt',
    'reverse'
  ]

  wrap(dns, 'dns', methods, wrapDns)

  function wrapDns(fn, method) {
    return agent.tracer.wrapFunctionLast('dns.' + method, null, fn)
  }
}
