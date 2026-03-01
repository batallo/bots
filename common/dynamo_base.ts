import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument, PutCommandInput, ScanCommandInput, TranslateConfig, UpdateCommandInput } from '@aws-sdk/lib-dynamodb';
import { CompositeKey } from '../moo_v_bot/types';

const docClientOptions: TranslateConfig = {
  marshallOptions: {
    removeUndefinedValues: true
  }
};

export class DynamoDbBase {
  private dbTitle: string;
  private docClient: DynamoDBDocument;

  constructor(dbTitle: string) {
    this.dbTitle = dbTitle;
    this.docClient = DynamoDBDocument.from(new DynamoDBClient(), docClientOptions);
  }

  async addItem<T extends Record<string, any>>(itemData: T) {
    let dataResponse;
    const putParams: PutCommandInput = { TableName: this.dbTitle, Item: itemData };
    try {
      dataResponse = await this.docClient.put(putParams);
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
      dataResponse = await this.docClient.get(params);
      console.log(`Queried DynamoDB: `, dataResponse?.Item);
    } catch (err) {
      console.error(`Error querying "${this.dbTitle}" DynamoDB: `, err);
    }

    return dataResponse?.Item as T;
  }

  async batchGetItem<T extends Record<string, any>>(compositeKeys: CompositeKey[]): Promise<T[]> {
    let dataResponse;

    const params = {
      RequestItems: {
        [this.dbTitle]: { Keys: compositeKeys }
      }
    };

    try {
      dataResponse = await this.docClient.batchGet(params);
      console.log(`Queried DynamoDB Batch: `, dataResponse?.Responses?.[this.dbTitle]);
    } catch (err) {
      console.error(`Error batch querying "${this.dbTitle}" DynamoDB: `, err);
    }

    return dataResponse?.Responses?.[this.dbTitle] as T[];
  }

  // TODO: implement handling LastEvaluatedKey if db grows
  async scanFotItem<T>(inputData: Omit<ScanCommandInput, 'TableName'>): Promise<T[]> {
    let dataResponse;

    const params = {
      TableName: this.dbTitle,
      ...inputData
    };

    try {
      dataResponse = await this.docClient.scan(params);
      console.log(`Scanning DynamoDB: `, dataResponse?.Items);
    } catch (err) {
      console.error(`Error scanning "${this.dbTitle}" DynamoDB: `, err);
    }

    return dataResponse?.Items as T[];
  }

  async removeItem<T extends Record<string, any>>(compositeKey: Partial<T>, removeProperty: string) {
    const removeParams: UpdateCommandInput = {
      TableName: this.dbTitle,
      Key: compositeKey,
      UpdateExpression: `REMOVE ${removeProperty}`,
      ReturnValues: 'UPDATED_NEW'
    };

    try {
      const dataResponse = await this.docClient.update(removeParams);
      console.log(`New value for DynamoDB item is: `, dataResponse?.Attributes?.movies);
    } catch (err) {
      console.error(`Error removing item from "${this.dbTitle}" DynamoDB: `, err);
    }
  }

  // TODO: improve typing for updateProperty
  async updateItem<T extends Record<string, any>>(compositeKey: Partial<T>, updateProperty: Partial<Record<keyof T, T[keyof T]>>) {
    const propName = Object.keys(updateProperty)[0];
    const proValue = updateProperty[propName];

    const updParams: UpdateCommandInput = {
      TableName: this.dbTitle,
      Key: compositeKey,
      UpdateExpression: `set ${propName} = :newValue`,
      ExpressionAttributeValues: {
        ':newValue': proValue
      },
      ReturnValues: 'UPDATED_NEW'
    };

    try {
      const dataResponse = await this.docClient.update(updParams);
      console.log(`Updated value for DynamoDB item is: `, dataResponse?.Attributes);
    } catch (err) {
      console.error(`Error updating item from "${this.dbTitle}" DynamoDB: `, err);
    }
  }
}
