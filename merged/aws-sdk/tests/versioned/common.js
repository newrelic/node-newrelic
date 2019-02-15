'use strict'

const EXTERN_PATTERN = /^External\/.*?amazonaws\.com/
const SQS_PATTERN = /^MessageBroker\/SQS\/Queue/
const SEGMENT_DESTINATION = 0x20

function checkAWSAttributes(t, segment, pattern, markedSegments = []) {
  const expectedAttrs = {
    'aws.operation': String,
    'aws.service': String,
    'aws.requestId': String,
    'aws.region': String
  }

  if (pattern.test(segment.name)) {
    markedSegments.push(segment)
    const attrs = segment.attributes.get(SEGMENT_DESTINATION)
    t.matches(attrs, expectedAttrs, 'should have aws attributes')
  }
  segment.children.forEach((child) => {
    checkAWSAttributes(t, child, pattern, markedSegments)
  })

  return markedSegments
}

module.exports = {
  EXTERN_PATTERN,
  SQS_PATTERN,
  SEGMENT_DESTINATION,

  checkAWSAttributes
}
