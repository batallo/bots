import { DynamoDB } from 'aws-sdk';

export class DynamoDbBase {
  private dbTitle: string;
  private docClient: DynamoDB.DocumentClient;

  constructor(dbTitle: string) {
    this.dbTitle = dbTitle;
    this.docClient = new DynamoDB.DocumentClient();
  }

  async addItem<T extends Record<string, any>>(itemData: T) {
    let dataResponse;
    const putParams = { TableName: this.dbTitle, Item: itemData }; // TO DO: update to output item as a result
    try {
      dataResponse = await this.docClient.put(putParams).promise();
      console.log(`Added item to DynamoDB: `, dataResponse?.Attributes);
    } catch (err) {
      console.error(`Error adding item to DynamoDB: `, err);
    }
  }

  async getItem<T extends Record<string, any>>(compositeKey: Partial<T>): Promise<T> {
    let dataResponse;

    const params = {
      TableName: this.dbTitle,
      Key: compositeKey
    };

    try {
      dataResponse = await this.docClient.get(params).promise();
      console.log(`Queried DynamoDB: `, dataResponse?.Item);
    } catch (err) {
      console.error(`Error querying "${this.dbTitle}" DynamoDB: `, err);
    }

    return dataResponse?.Item as T;
  }

  // TODO: improve typing for compositeKeys
  async batchGetItem<T extends Record<string, any>>(compositeKeys: Partial<T>[]): Promise<T[]> {
    let dataResponse;

    const params = {
      RequestItems: {
        [this.dbTitle]: { Keys: compositeKeys }
      }
    };

    try {
      dataResponse = await this.docClient.batchGet(params).promise();
      console.log(`Queried DynamoDB Batch: `, dataResponse?.Responses?.[this.dbTitle]);
    } catch (err) {
      console.error(`Error batch querying "${this.dbTitle}" DynamoDB: `, err);
    }

    return dataResponse?.Responses?.[this.dbTitle] as T[];
  }

  // TODO: improve typing for compositeKeys
  async scanFotItem<T extends Record<string, any>>(inputData: Partial<T>[]): Promise<T[]> {
    let dataResponse;

    const attributes = inputData.flatMap(el => Object.keys(el));

    const params = {
      TableName: this.dbTitle,
      FilterExpression: '',
      ExpressionAttributeNames: {} as Record<string, string>,
      ExpressionAttributeValues: {} as Record<string, any>
    };

    attributes.forEach((key, i) => {
      const expressionKey = `#param_${i}`;
      const expressionValue = `:value_${i}`;

      params.ExpressionAttributeNames[expressionKey] = key;
      params.ExpressionAttributeValues[expressionValue] = inputData[i][key];
      params.FilterExpression += (!i ? '' : ' AND ') + `${expressionKey} = ${expressionValue}`;
    });

    try {
      dataResponse = await this.docClient.scan(params).promise();
      console.log(`Scanning DynamoDB: `, dataResponse?.Items);
      console.log(`Scanning DynamoDB: `, dataResponse); //temp
      console.log(`Scanning DynamoDB: `, params); //temp
    } catch (err) {
      console.error(`Error scanning "${this.dbTitle}" DynamoDB: `, err);
    }

    return dataResponse?.Items as T[];
  }

  async removeItem<T extends Record<string, any>>(compositeKey: Partial<T>, removeProperty: string) {
    const removeParams = {
      TableName: this.dbTitle,
      Key: compositeKey,
      UpdateExpression: `REMOVE ${removeProperty}`,
      ReturnValues: 'ALL_NEW'
    };

    try {
      const dataResponse = await this.docClient.update(removeParams).promise();
      console.log(`New value for DynamoDB item is: `, dataResponse?.Attributes?.movies);
    } catch (err) {
      console.error(`Error removing item from "${this.dbTitle}" DynamoDB: `, err);
    }
  }

  // TODO: improve typing for updateProperty
  async updateItem<T extends Record<string, any>>(compositeKey: Partial<T>, updateProperty: Partial<Record<keyof T, T[keyof T]>>) {
    const propName = Object.keys(updateProperty)[0];
    const proValue = updateProperty[propName];

    const updParams = {
      TableName: this.dbTitle,
      Key: compositeKey,
      UpdateExpression: `set ${propName} = :newValue`,
      ExpressionAttributeValues: {
        ':newValue': proValue
      },
      ReturnValues: 'UPDATED_NEW'
    };

    try {
      const dataResponse = await this.docClient.update(updParams).promise();
      console.log(`Updated value for DynamoDB item is: `, dataResponse?.Attributes);
    } catch (err) {
      console.error(`Error updating item from "${this.dbTitle}" DynamoDB: `, err);
    }
  }
}
