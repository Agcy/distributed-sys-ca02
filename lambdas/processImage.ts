/* eslint-disable import/extensions, import/no-absolute-path */
import { SQSHandler } from "aws-lambda";
import {
    GetObjectCommand,
    PutObjectCommandInput,
    GetObjectCommandInput,
    S3Client,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient, PutCommand} from "@aws-sdk/lib-dynamodb";
import { SES_REGION, TABLE_NAME } from "../env";

const s3 = new S3Client();
const ddb = createDDbDocClient();

export const handler: SQSHandler = async (event) => {
    console.log("Event ", JSON.stringify(event));
    for (const record of event.Records) {
        const recordBody = JSON.parse(record.body);  // Parse SQS message
        const snsMessage = JSON.parse(recordBody.Message); // Parse SNS message

        if (snsMessage.Records) {
            console.log("Record body ", JSON.stringify(snsMessage));
            for (const messageRecord of snsMessage.Records) {
                const s3e = messageRecord.s3;
                const srcBucket = s3e.bucket.name;
                // Object key may have spaces or unicode non-ASCII characters.
                const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
                // Check the img extension
                if (!srcKey.toLowerCase().endsWith('.jpeg') && !srcKey.toLowerCase().endsWith('.png')) {
                    console.error(`Unsupported file type for key: ${srcKey}`);
                    throw new Error(`Unsupported file type: Files must be JPEG or PNG in ${srcBucket}.`);
                }

                try {
                    const ddbParams = {
                        TableName: TABLE_NAME,
                        Item: {
                            'ImageName': { S: srcKey },
                        }
                    };
                    await ddb.send(new PutItemCommand(ddbParams));
                } catch (error) {
                    console.error(`Error processing image or writing to DynamoDB: ${error}`);
                    console.log(error);
                }
            }
        }
    }
};

function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({ region: SES_REGION });
    const marshallOptions = {
        convertEmptyValues: true, removeUndefinedValues: true, convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
        wrapNumbers: false,
    };
    const translateConfig = { marshallOptions, unmarshallOptions };
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
