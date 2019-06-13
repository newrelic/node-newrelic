'use strict'

const DDB_OPERATIONS = [
  'putItem',
  'getItem',
  'updateItem',
  'deleteItem',
  'createTable',
  'deleteTable',
  'query',
  'scan'
]

const DOC_CLIENT_OPERATIONS = [
  'get',
  'put',
  'update',
  'delete',
  'query',
  'scan'
]

function instrument(shim, AWS) {
  shim.setDatastore(shim.DYNAMODB)

  shim.wrapReturn(AWS, 'DynamoDB', function wrapDynamo(shim, fn, name, ddb) {
    shim.recordOperation(
      ddb,
      DDB_OPERATIONS,
      function wrapMethod(shim, original, operationName, args) {
        const params = args[0]

        return {
          name: operationName,
          parameters: {
            host: this.endpoint.host,
            port_path_or_id: this.endpoint.port,
            collection: params && params.TableName || 'Unknown'
          },
          callback: shim.LAST,
          opaque: true
        }
      }
    )
  })

  // DocumentClient does defer to DynamoDB but it also does enough individual
  // steps for the request we want to hide that instrumenting specifically and
  // setting to opaque is required.
  shim.wrapReturn(
    AWS.DynamoDB,
    'DocumentClient',
    function wrapDocumentClient(shim, fn, name, documentClient) {
      shim.recordOperation(
        documentClient,
        DOC_CLIENT_OPERATIONS,
        function wrapOperation(shim, original, operationName, args) {
          const params = args[0]
          const dynamoOperation = this.serviceClientOperationsMap[operationName]

          return {
            name: dynamoOperation,
            parameters: {
              host: this.service.endpoint.host,
              port_path_or_id: this.service.endpoint.port,
              collection: params && params.TableName || 'Unknown'
            },
            callback: shim.LAST,
            opaque: true
          }
        }
      )
    }
  )
}

module.exports = {
  name: 'dynamodb',
  type: 'datastore',
  instrument,
  validate: (shim, AWS) => {
    if (!shim.isFunction(AWS.DynamoDB)) {
      shim.logger.debug('Could not find DynamoDB, not instrumenting.')
      return false
    }
    return true
  }
}
