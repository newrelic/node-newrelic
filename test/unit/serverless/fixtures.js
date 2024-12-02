/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const httpApiGatewayV1Event = {
  version: '1.0',
  resource: '/my/path',
  path: '/my/path',
  httpMethod: 'GET',
  headers: {
    header1: 'value1',
    header2: 'value2'
  },
  multiValueHeaders: {
    header1: ['value1'],
    header2: ['value1', 'value2']
  },
  queryStringParameters: {
    parameter1: 'value1',
    parameter2: 'value'
  },
  multiValueQueryStringParameters: {
    parameter1: ['value1', 'value2'],
    parameter2: ['value']
  },
  requestContext: {
    accountId: '123456789012',
    apiId: 'id',
    authorizer: {
      claims: null,
      scopes: null
    },
    domainName: 'id.execute-api.us-east-1.amazonaws.com',
    domainPrefix: 'id',
    extendedRequestId: 'request-id',
    httpMethod: 'GET',
    identity: {
      accessKey: null,
      accountId: null,
      caller: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '192.0.2.1',
      user: null,
      userAgent: 'user-agent',
      userArn: null,
      clientCert: {
        clientCertPem: 'CERT_CONTENT',
        subjectDN: 'www.example.com',
        issuerDN: 'Example issuer',
        serialNumber: 'a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1',
        validity: {
          notBefore: 'May 28 12:30:02 2019 GMT',
          notAfter: 'Aug  5 09:36:04 2021 GMT'
        }
      }
    },
    path: '/my/path',
    protocol: 'HTTP/1.1',
    requestId: 'id=',
    requestTime: '04/Mar/2020:19:15:17 +0000',
    requestTimeEpoch: 1583349317135,
    resourceId: null,
    resourcePath: '/my/path',
    stage: '$default'
  },
  pathParameters: null,
  stageVariables: null,
  body: 'Hello from Lambda!',
  isBase64Encoded: false
}

// https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
const restApiGatewayV1Event = {
  resource: '/my/path',
  path: '/my/path',
  httpMethod: 'GET',
  headers: {
    header1: 'value1',
    header2: 'value2'
  },
  multiValueHeaders: {
    header1: ['value1'],
    header2: ['value1', 'value2']
  },
  queryStringParameters: {
    parameter1: 'value1',
    parameter2: 'value'
  },
  multiValueQueryStringParameters: {
    parameter1: ['value1', 'value2'],
    parameter2: ['value']
  },
  requestContext: {
    accountId: '123456789012',
    apiId: 'id',
    authorizer: {
      claims: null,
      scopes: null
    },
    domainName: 'id.execute-api.us-east-1.amazonaws.com',
    domainPrefix: 'id',
    extendedRequestId: 'request-id',
    httpMethod: 'GET',
    identity: {
      accessKey: null,
      accountId: null,
      caller: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '192.0.2.1',
      user: null,
      userAgent: 'user-agent',
      userArn: null,
      clientCert: {
        clientCertPem: 'CERT_CONTENT',
        subjectDN: 'www.example.com',
        issuerDN: 'Example issuer',
        serialNumber: 'a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1',
        validity: {
          notBefore: 'May 28 12:30:02 2019 GMT',
          notAfter: 'Aug  5 09:36:04 2021 GMT'
        }
      }
    },
    path: '/my/path',
    protocol: 'HTTP/1.1',
    requestId: 'id=',
    requestTime: '04/Mar/2020:19:15:17 +0000',
    requestTimeEpoch: 1583349317135,
    resourceId: null,
    resourcePath: '/my/path',
    stage: '$default'
  },
  pathParameters: null,
  stageVariables: null,
  body: 'Hello from Lambda!',
  isBase64Encoded: false
}

// https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
const httpApiGatewayV2Event = {
  version: '2.0',
  routeKey: '$default',
  rawPath: '/my/path',
  rawQueryString: 'parameter1=value1&parameter1=value2&parameter2=value',
  cookies: ['cookie1', 'cookie2'],
  headers: {
    header1: 'value1',
    header2: 'value1,value2',
    accept: 'application/json'
  },
  queryStringParameters: {
    parameter1: 'value1,value2',
    parameter2: 'value',
    name: 'me',
    team: 'node agent'
  },
  requestContext: {
    accountId: '123456789012',
    apiId: 'api-id',
    authentication: {
      clientCert: {
        clientCertPem: 'CERT_CONTENT',
        subjectDN: 'www.example.com',
        issuerDN: 'Example issuer',
        serialNumber: 'a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1',
        validity: {
          notBefore: 'May 28 12:30:02 2019 GMT',
          notAfter: 'Aug  5 09:36:04 2021 GMT'
        }
      }
    },
    authorizer: {
      jwt: {
        claims: {
          claim1: 'value1',
          claim2: 'value2'
        },
        scopes: ['scope1', 'scope2']
      }
    },
    domainName: 'id.execute-api.us-east-1.amazonaws.com',
    domainPrefix: 'id',
    http: {
      method: 'POST',
      path: '/my/path',
      protocol: 'HTTP/1.1',
      sourceIp: '192.0.2.1',
      userAgent: 'agent'
    },
    requestId: 'id',
    routeKey: '$default',
    stage: '$default',
    time: '12/Mar/2020:19:03:58 +0000',
    timeEpoch: 1583348638390
  },
  body: 'Hello from Lambda',
  pathParameters: {
    parameter1: 'value1'
  },
  isBase64Encoded: false,
  stageVariables: {
    stageVariable1: 'value1',
    stageVariable2: 'value2'
  }
}

const httpApiGatewayV2EventAlt = {
  version: '2.0',
  routeKey: 'ANY /',
  rawPath: '/dev/',
  rawQueryString: '',
  headers: {
    'accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-encoding': 'gzip, deflate, br, zstd',
    'accept-language': 'en-US,en;q=0.9',
    'content-length': '0',
    'host': 'zzz1234567890.execute-api.us-east-2.amazonaws.com',
    'priority': 'u=0, i',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'cross-site',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'x-amzn-trace-id': 'Root=1-abcdef01-01234567890abcdef0123456',
    'x-forwarded-for': '11.11.11.148',
    'x-forwarded-port': '443',
    'x-forwarded-proto': 'https'
  },
  requestContext: {
    accountId: '466768951184',
    apiId: 'zzz1234567890',
    domainName: 'zzz1234567890.execute-api.us-east-2.amazonaws.com',
    domainPrefix: 'zzz1234567890',
    http: {
      method: 'GET',
      path: '/dev/',
      protocol: 'HTTP/1.1',
      sourceIp: '11.11.11.148',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    },
    requestId: 'ABCDEF0123456=',
    routeKey: 'ANY /',
    stage: 'dev',
    time: '26/Nov/2024:19:14:00 +0000',
    timeEpoch: 1732648440329
  },
  isBase64Encoded: false
}

const albEvent = {
  requestContext: {
    elb: {
      targetGroupArn:
        'arn:aws:elasticloadbalancing:us-west-2:1234567890:path/directory/otherDirectory'
    }
  },
  httpMethod: 'POST',
  path: '/elbCategory/elbEndpoint',
  queryStringParameters: {
    parameter1: 'value1,value2',
    parameter2: 'value',
    name: 'me',
    team: 'node agent'
  },
  headers: {
    'accept': 'application/json;v=4',
    'content-length': '35',
    'content-type': 'application/json',
    'header2': 'value1,value2',
    'host': 'examplehost.example.com',
    'x-amzn-trace-id': 'Root=1-1234567890',
    'x-forwarded-for': '10.10.10.10',
    'x-forwarded-port': '443',
    'x-forwarded-proto': 'https',
    'x-message-id': 'albtest'
  },
  body: '{"exampleProperty": "exampleValue"}',
  isBase64Encoded: false,
  rawHeaders: {
    'accept': 'application/json;v=4',
    'content-length': '35',
    'content-type': 'application/json',
    'host': 'examplehost.example.com',
    'x-amzn-trace-id': 'Root=1-1234567890',
    'x-forwarded-for': '10.10.10.10',
    'x-forwarded-port': '443',
    'x-forwarded-proto': 'https',
    'x-message-id': 'albtest'
  },
  multiValueQueryStringParameters: {},
  pathParameters: {}
}

// Event used when one Lambda directly invokes another Lambda.
// https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-retain-records.html#invocation-async-destinations
const lambaV1InvocationEvent = {
  version: '1.0',
  timestamp: '2019-11-14T18:16:05.568Z',
  requestContext: {
    requestId: 'e4b46cbf-b738-xmpl-8880-a18cdf61200e',
    functionArn: 'arn:aws:lambda:us-east-2:123456789012:function:my-function:$LATEST',
    condition: 'RetriesExhausted',
    approximateInvokeCount: 3
  },
  requestPayload: {
    ORDER_IDS: [
      '9e07af03-ce31-4ff3-xmpl-36dce652cb4f',
      '637de236-e7b2-464e-xmpl-baf57f86bb53',
      'a81ddca6-2c35-45c7-xmpl-c3a03a31ed15'
    ]
  },
  responseContext: {
    statusCode: 200,
    executedVersion: '$LATEST',
    functionError: 'Unhandled'
  },
  responsePayload: {
    errorMessage:
      'RequestId: e4b46cbf-b738-xmpl-8880-a18cdf61200e Process exited before completing request'
  }
}

module.exports = {
  restApiGatewayV1Event,
  httpApiGatewayV1Event,
  httpApiGatewayV2Event,
  httpApiGatewayV2EventAlt,
  albEvent,
  lambaV1InvocationEvent
}
