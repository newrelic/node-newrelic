'use strict'

const kinesisDataStreamEvent = {
  "Records": [{
    "eventID":
    "shardId-000000000000:49545115243490985018280067714973144582180062593244200961",
    "eventVersion": "1.0",
    "kinesis": {
      "partitionKey": "partitionKey-3",
      "data": "SGVsbG8sIHRoaXMgaXMgYSB0ZXN0IDEyMy4=",
      "kinesisSchemaVersion": "1.0",
      "sequenceNumber": "49545115243490985018280067714973144582180062593244200961"
    },
    "invokeIdentityArn": "identityarn",
    "eventName": "aws:kinesis:record",
    "eventSourceARN": "kinesis:eventsourcearn",
    "eventSource": "aws:kinesis",
    "awsRegion": "us-east-1"
  }]
}

const s3PutEvent = {
  "Records": [{
    "eventVersion": "2.0",
    "eventTime": "1970-01-01T00:00:00.000Z",
    "requestParameters": {
      "sourceIPAddress": "127.0.0.1"
    },
    "s3": {
      "configurationId": "testConfigRule",
      "object": {
        "eTag": "0123456789abcdef0123456789abcdef",
        "sequencer": "0A1B2C3D4E5F678901",
        "key": "HappyFace.jpg",
        "size": 1024
      },
      "bucket": {
        "arn": "bucketarn",
        "name": "sourcebucket",
        "ownerIdentity": {
          "principalId": "EXAMPLE"
        }
      },
      "s3SchemaVersion": "1.0"
    },
    "responseElements": {
      "x-amz-id-2": "EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH",
      "x-amz-request-id": "EXAMPLE123456789"
    },
    "awsRegion": "us-east-1",
    "eventName": "ObjectCreated:Put",
    "userIdentity": {
      "principalId": "EXAMPLE"
    },
    "eventSource": "aws:s3"
  }]
}

const snsEvent = {
  "Records": [{
    "EventVersion": "1.0",
    "EventSubscriptionArn": "eventsubscriptionarn",
    "EventSource": "aws:sns",
    "Sns": {
      "SignatureVersion": "1",
      "Timestamp": "1970-01-01T00:00:00.000Z",
      "Signature": "EXAMPLE",
      "SigningCertUrl": "EXAMPLE",
      "MessageId": "95df01b4-ee98-5cb9-9903-4c221d41eb5e",
      "Message": "Hello from SNS!",
      "MessageAttributes": {
        "Test": {
          "Type": "String",
          "Value": "TestString"
        },
        "TestBinary": {
          "Type": "Binary",
          "Value": "TestBinary"
        }
      },
      "Type": "Notification",
      "UnsubscribeUrl": "EXAMPLE",
      "TopicArn": "topicarn",
      "Subject": "TestInvoke"
    }
  }]
}

const dynamoDbUpdateEvent = {
  "Records": [{
    "eventID": "1",
    "eventVersion": "1.0",
    "dynamodb": {
      "Keys": {
        "Id": {
          "N": "101"
        }
      },
      "NewImage": {
        "Message": {
          "S": "New item!"
        },
        "Id": {
          "N": "101"
        }
      },
      "StreamViewType": "NEW_AND_OLD_IMAGES",
      "SequenceNumber": "111",
      "SizeBytes": 26
    },
    "awsRegion": "us-west-2",
    "eventName": "INSERT",
    "eventSourceARN": "dynamodb:eventsourcearn",
    "eventSource": "aws:dynamodb"
  },
  {
    "eventID": "2",
    "eventVersion": "1.0",
    "dynamodb": {
      "OldImage": {
        "Message": {
          "S": "New item!"
        },
        "Id": {
          "N": "101"
        }
      },
      "SequenceNumber": "222",
      "Keys": {
        "Id": {
          "N": "101"
        }
      },
      "SizeBytes": 59,
      "NewImage": {
        "Message": {
          "S": "This item has changed"
        },
        "Id": {
          "N": "101"
        }
      },
      "StreamViewType": "NEW_AND_OLD_IMAGES"
    },
    "awsRegion": "us-west-2",
    "eventName": "MODIFY",
    "eventSourceARN": "sourcearn",
    "eventSource": "aws:dynamodb"
  },
  {
    "eventID": "3",
    "eventVersion": "1.0",
    "dynamodb": {
      "Keys": {
        "Id": {
          "N": "101"
        }
      },
      "SizeBytes": 38,
      "SequenceNumber": "333",
      "OldImage": {
        "Message": {
          "S": "This item has changed"
        },
        "Id": {
          "N": "101"
        }
      },
      "StreamViewType": "NEW_AND_OLD_IMAGES"
    },
    "awsRegion": "us-west-2",
    "eventName": "REMOVE",
    "eventSourceARN": "sourcearn",
    "eventSource": "aws:dynamodb"
  }]
}

const codeCommitEvent = {
  "Records": [{
    "eventId": "5a824061-17ca-46a9-bbf9-114edeadbeef",
    "eventVersion": "1.0",
    "eventTime": "2016-01-01T23:59:59.000+0000",
    "eventTriggerName": "my-trigger",
    "eventPartNumber": 1,
    "codecommit": {
      "references": [
        {
          "commit": "5c4ef1049f1d27deadbeeff313e0730018be182b",
          "ref": "refs/heads/master"
        }
      ]
    },
    "eventName": "TriggerEventTest",
    "eventTriggerConfigId": "5a824061-17ca-46a9-bbf9-114edeadbeef",
    "eventSourceARN": "arn:aws:codecommit:us-west-2:123456789012:my-repo",
    "userIdentityARN": "arn:aws:iam::123456789012:root",
    "eventSource": "aws:codecommit",
    "awsRegion": "us-west-2",
    "eventTotalParts": 1
  }]
}

const cloudFrontEvent = {
  "Records": [{
    "cf": {
      "config": {
        "distributionId": "EDFDVBD6EXAMPLE"
      },
      "request": {
        "clientIp": "2001:0db8:85a3:0:0:8a2e:0370:7334",
        "method": "GET",
        "uri": "/picture.jpg",
        "headers": {
          "host": [
            {
              "key": "Host",
              "value": "d111111abcdef8.cloudfront.net"
            }
          ],
          "user-agent": [
            {
              "key": "User-Agent",
              "value": "curl/7.51.0"
            }
          ]
        }
      }
    }
  }]
}

const cloudFormationCreateRequestEvent = {
  "StackId": "arn:aws:cloudformation:us-west-2:EXAMPLE/stack-name/guid",
  "ResponseURL": "http://pre-signed-S3-url-for-response",
  "ResourceProperties": {
    "StackName": "stack-name",
    "List": [
      "1",
      "2",
      "3"
    ]
  },
  "RequestType": "Create",
  "ResourceType": "Custom::TestResource",
  "RequestId": "unique id for this create request",
  "LogicalResourceId": "MyTestResource"
}

const apiGatewayProxyEvent = {
  "path": "/test/hello",
  "headers": {
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, lzma, sdch, br",
    "Accept-Language": "en-US,en;q=0.8",
    "CloudFront-Forwarded-Proto": "https",
    "CloudFront-Is-Desktop-Viewer": "true",
    "CloudFront-Is-Mobile-Viewer": "false",
    "CloudFront-Is-SmartTV-Viewer": "false",
    "CloudFront-Is-Tablet-Viewer": "false",
    "CloudFront-Viewer-Country": "US",
    "Host": "wt6mne2s9k.execute-api.us-west-2.amazonaws.com",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6)",
    "Via": "1.1 fb7cca60f0ecd82ce07790c9c5eef16c.cloudfront.net (CloudFront)",
    "X-Amz-Cf-Id": "nBsWBOrSHMgnaROZJK1wGCZ9PcRcSpq_oSXZNQwQ10OTZL4cimZo3g==",
    "X-Forwarded-For": "192.168.100.1, 192.168.1.1",
    "X-Forwarded-Port": "443",
    "X-Forwarded-Proto": "https"
  },
  "pathParameters": {
    "proxy": "hello"
  },
  "requestContext": {
    "accountId": "123456789012",
    "resourceId": "us4z18",
    "stage": "test",
    "requestId": "41b45ea3-70b5-11e6-b7bd-69b5aaebc7d9",
    "identity": {
      "cognitoIdentityPoolId": "",
      "accountId": "",
      "cognitoIdentityId": "",
      "caller": "",
      "apiKey": "",
      "sourceIp": "192.168.100.1",
      "cognitoAuthenticationType": "",
      "cognitoAuthenticationProvider": "",
      "userArn": "",
      "userAgent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6)",
      "user": ""
    },
    "resourcePath": "/{proxy+}",
    "httpMethod": "GET",
    "apiId": "wt6mne2s9k"
  },
  "resource": "/{proxy+}",
  "httpMethod": "GET",
  "queryStringParameters": {
    "name": "me",
    "team": "node agent"
  },
  "stageVariables": {
    "stageVarName": "stageVarValue"
  }
}

const cloudWatchLogsEvent = {
  "awslogs": {
    "data":
      "l7KSN7tCOEJ4M3/qOI49vMHj+zCKdlFqLaU2ZHV2a4Ct/an0/ivdX8oYc1UVX860fQDQiMdxRQEAAA=="
  }
}

const kinesisDataFirehoseEvent = {
  "invocationId": "invoked123",
  "deliveryStreamArn": "aws:lambda:events",
  "region": "us-west-2",
  "records": [
    {
      "data": "SGVsbG8gV29ybGQ=",
      "recordId": "record1",
      "approximateArrivalTimestamp": 1510772160000,
      "kinesisRecordMetadata": {
        "shardId": "shardId-000000000000",
        "partitionKey": "4d1ad2b9-24f8-4b9d-a088-76e9947c317a",
        "approximateArrivalTimestamp": "2012-04-23T18:25:43.511Z",
        "sequenceNumber": "49546986683135544286507457936321625675700192471156785154",
        "subsequenceNumber": ""
      }
    },
    {
      "data": "SGVsbG8gV29ybGQ=",
      "recordId": "record2",
      "approximateArrivalTimestamp": 151077216000,
      "kinesisRecordMetadata": {
        "shardId": "shardId-000000000001",
        "partitionKey": "4d1ad2b9-24f8-4b9d-a088-76e9947c318a",
        "approximateArrivalTimestamp": "2012-04-23T19:25:43.511Z",
        "sequenceNumber": "49546986683135544286507457936321625675700192471156785155",
        "subsequenceNumber": ""
      }
    }
  ]
}

module.exports = {
  kinesisDataStreamEvent: kinesisDataStreamEvent,
  s3PutEvent: s3PutEvent,
  snsEvent: snsEvent,
  dynamoDbUpdateEvent: dynamoDbUpdateEvent,
  codeCommitEvent: codeCommitEvent,
  cloudFrontEvent: cloudFrontEvent,
  cloudFormationCreateRequestEvent: cloudFormationCreateRequestEvent,
  apiGatewayProxyEvent: apiGatewayProxyEvent,
  cloudWatchLogsEvent: cloudWatchLogsEvent,
  kinesisDataFirehoseEvent: kinesisDataFirehoseEvent
}
