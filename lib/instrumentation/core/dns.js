'use strict'

module.exports = initialize

function initialize(agent, dns, moduleName, shim) {
  const methods = [
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

  shim.record(
    dns,
    methods,
    function recordDnsMethod(shim, fn, name) {
      return { name: 'dns.' + name, callback: shim.LAST }
    }
  )
}
