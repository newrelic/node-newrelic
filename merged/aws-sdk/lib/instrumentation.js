'use strict'

const INSTRUMENTATIONS = [
  require('./core'),
  require('./dynamodb'),
  require('./sqs'),
  require('./sns')
]

module.exports = function initialize(shim, AWS) {
  // Validate every instrumentation before attempting to run any of them.
  for (let instrumentation of INSTRUMENTATIONS) {
    if (!instrumentation.validate(shim, AWS)) {
      return false
    }
  }

  for (let instrumentation of INSTRUMENTATIONS) {
    const subshim = shim.makeSpecializedShim(instrumentation.type, instrumentation.name)
    instrumentation.instrument(subshim, AWS)
  }

  return true
}
