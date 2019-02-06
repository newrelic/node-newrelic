'use strict'

function checkAWSExternals(t, segment, externalSegments = []) {
  const expectedParams = {
    'aws.operation': String,
    // 'aws.service': String, // TODO: Bring back the service name.
    'aws.requestId': String
  }

  if (/^External\/.*?amazonaws\.com/.test(segment.name)) {
    externalSegments.push(segment)
    t.matches(segment.parameters, expectedParams, 'should have aws parameters')
  }
  segment.children.forEach((child) => {
    checkAWSExternals(t, child, externalSegments)
  })

  return externalSegments
}

module.exports = {
  checkAWSExternals
}
