'use strict'

module.exports = {
  tableDef: {
    AttributeDefinitions: [
      {
        AttributeName: 'Artist',
        AttributeType: 'S'
      },
      {
        AttributeName: 'SongTitle',
        AttributeType: 'S'
      }
    ],
    KeySchema: [
      {
        AttributeName: 'Artist',
        KeyType: 'HASH'
      },
      {
        AttributeName: 'SongTitle',
        KeyType: 'RANGE'
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    },
    TableName: 'Music'
  },
  itemDef: {
    Item: {
      AlbumTitle: {
        S: 'Somewhat Famous'
      },
      Artist: {
        S: 'No One You Know'
      },
      SongTitle: {
        S: 'Call Me Today'
      }
    },
    TableName: 'Music'
  },
  item: {
    Key: {
      Artist: {
        S: 'No One You Know'
      },
      SongTitle: {
        S: 'Call Me Today'
      }
    },
    TableName: 'Music'
  },
  query: {
    ExpressionAttributeValues: {
     ':v1': {
       S: 'No One You Know'
      }
    },
    KeyConditionExpression: 'Artist = :v1',
    TableName: 'Music'
  }
}
