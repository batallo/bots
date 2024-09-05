import AWS from 'aws-sdk';
import { MooVBot } from './src';

const docClient = new AWS.DynamoDB.DocumentClient();
const mooVBot = new MooVBot(process.env.TOKEN_BOT_MOO_V as string);

export async function handler(event: any) {
  const request = event.body && JSON.parse(event.body);
  const response = {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda!')
  };

  if (!request) return response;

  const innerValue = request.message || request.channel_post;
  // const memberAction = request.body.my_chat_member;

  console.warn(innerValue);

  if (innerValue) {
    const chatId = innerValue.chat.id;
    const inputMessage = innerValue.text;
    if (inputMessage) {
      if (inputMessage == 'getDb') {
        let txt: any;

        const params = {
          TableName: 'moo_v_bot',
          KeyConditionExpression: 'group_id = :gid',
          ExpressionAttributeValues: {
            ':gid': 0
          }
        };

        try {
          const data = await docClient.query(params).promise();
          txt = data.Items;
        } catch (err) {
          console.error('Error', err);
        }
        await mooVBot.sendToTelegram(chatId, txt);
      } else if (inputMessage == 'лол') {
        await mooVBot.sendToTelegram(chatId, 'кек');
      } else {
        await mooVBot.sendToTelegram(chatId, mooVBot.getRythme(inputMessage));
      }
    }
  }

  return { statusCode: 200 };
}
