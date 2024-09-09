import { DynamoDB } from 'aws-sdk';

export class DynamoDbBase {
  private dbTitle: string;
  private docClient: DynamoDB.DocumentClient;

  constructor(dbTitle: string) {
    this.dbTitle = dbTitle;
    this.docClient = new DynamoDB.DocumentClient();
  }

  async addItem<T extends Record<string, any>>(itemData: T) {
    const putParams = { TableName: this.dbTitle, Item: itemData };
    try {
      await this.docClient.put(putParams).promise();
    } catch (err) {
      console.error(`Error updating "${this.dbTitle}" DynamoDB: `, err);
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
    } catch (err) {
      console.error(`Error querying "${this.dbTitle}" DynamoDB: `, err);
    }

    return dataResponse?.Item as T;
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
