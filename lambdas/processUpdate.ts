import { SNSEvent, SNSHandler } from 'aws-lambda';
import {DynamoDBClient, ReturnValue, UpdateItemCommand} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, GetCommand, UpdateCommand} from "@aws-sdk/lib-dynamodb";
import {TABLE_NAME} from "../env";

const ddb = createDDbDocClient(); // Specify your AWS region

export const handler: SNSHandler = async (event: SNSEvent) => {
    for (const record of event.Records) {
        const message = JSON.parse(record.Sns.Message);
        const attributes = record.Sns.MessageAttributes;
        // const {imageKey, newDescription} = message;

            if (attributes.comment_type && attributes.comment_type.Value === 'Caption') {
                const imageKey = message.name
                const newDescription = message.description;

                const getItemParams = {
                    TableName: TABLE_NAME,
                    Key: {imageName: imageKey},
                };
                try {
                    console.log("Get Item Begin")
                    const {Item} = await ddb.send(new GetCommand(getItemParams));
                    console.log("get Item")
                    if (Item) {
                        console.log("get Item success")
                        const params = {
                            TableName: TABLE_NAME,
                            Key: {
                                imageName: imageKey
                            },
                            UpdateExpression: 'set Description = :description',
                            ExpressionAttributeValues: {
                                ':description': newDescription
                            },
                            // ReturnValues: 'UPDATED_NEW' as ReturnValue
                        };
                        try {
                            // Attempt to update the item in DynamoDB
                            const result = await ddb.send(new UpdateCommand(params));
                            console.log(`Updated item with key ${imageKey}:`, result);
                        } catch (error) {
                            console.error("Error updating item in DynamoDB: ", error);
                            throw new Error(`Unable to update item with key ${imageKey} in DynamoDB.`);
                        }
                    }
                }catch (error){
                    console.error("Error updating item in DynamoDB: ", error);
                    throw new Error(`Image "${imageKey}" not exists.`);
                }
                // const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
                // Prepare the update command for the DynamoDB table



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
