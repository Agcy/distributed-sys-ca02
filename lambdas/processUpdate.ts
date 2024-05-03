import { SNSEvent, SNSHandler } from 'aws-lambda';
import {DynamoDBClient, ReturnValue, UpdateItemCommand} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient} from "@aws-sdk/lib-dynamodb";
import {TABLE_NAME} from "../env";

const ddb = createDDbDocClient(); // Specify your AWS region

export const handler: SNSHandler = async (event: SNSEvent) => {
    for (const record of event.Records) {
        const message = JSON.parse(record.Sns.Message);
        // const {imageKey, newDescription} = message;

        if (message.Records) {
            const s3e = message.s3;
            const imageKey = message.name
            const newDescription = message.description;

            const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
            // Prepare the update command for the DynamoDB table
            const params = {
                TableName: TABLE_NAME,
                Key: {
                    'ImageName': {S: imageKey}
                },
                UpdateExpression: 'set Description = :d',
                ExpressionAttributeValues: {
                    ':d': {S: newDescription}
                },
                ReturnValues: 'UPDATED_NEW' as ReturnValue
            };

            try {
                // Attempt to update the item in DynamoDB
                const result = await ddb.send(new UpdateItemCommand(params));
                console.log(`Updated item with key ${imageKey}:`, result);
            } catch (error) {
                console.error("Error updating item in DynamoDB: ", error);
                throw new Error(`Unable to update item with key ${imageKey} in DynamoDB.`);
            }
        }
    }
};

function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
    const marshallOptions = {
        convertEmptyValues: true, removeUndefinedValues: true, convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
        wrapNumbers: false,
    };
    const translateConfig = { marshallOptions, unmarshallOptions };
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
