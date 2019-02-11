'use strict'

const EXTERN_PATTERN = /^External\/.*?amazonaws\.com/

function checkAWSAttributes(t, segment, pattern, markedSegments = []) {
  const expectedParams = {
    'aws.operation': String,
    'aws.service': String,
    'aws.requestId': String,
    'aws.region': String
  }

  if (pattern.test(segment.name)) {
    markedSegments.push(segment)
    t.matches(segment.parameters, expectedParams, 'should have aws attributes')
  }
  segment.children.forEach((child) => {
    checkAWSAttributes(t, child, pattern, markedSegments)
  })

  return markedSegments
}

module.exports = {
  EXTERN_PATTERN,

  checkAWSAttributes
}
