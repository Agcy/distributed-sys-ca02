import {SNSEvent, SNSHandler} from 'aws-lambda';
import {
    GetObjectCommand,
    PutObjectCommandInput,
    GetObjectCommandInput,
    S3Client,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import {DynamoDBClient, DeleteItemCommand, PutItemCommand} from '@aws-sdk/client-dynamodb';
import {DeleteCommand, DynamoDBDocumentClient} from "@aws-sdk/lib-dynamodb";
import {TABLE_NAME} from "../env";

const s3 = new S3Client();
const ddb = createDDbDocClient(); // Specify your AWS region

export const handler: SNSHandler = async (event: SNSEvent) => {
    console.log("Event ", JSON.stringify(event));
    for (const record of event.Records) {
        const snsMessage = JSON.parse(record.Sns.Message); // Parse SNS message

        if (snsMessage.Records) {
            console.log("Record body ", JSON.stringify(snsMessage));
            for (const messageRecord of snsMessage.Records) {
                const s3e = messageRecord.s3;
                const srcBucket = s3e.bucket.name;
                // Object key may have spaces or unicode non-ASCII characters.
                const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
                // Process the image ......
                // Write item to DynamoDB
                let origimage = null;
                const params: GetObjectCommandInput = {
                    Bucket: srcBucket,
                    Key: srcKey,
                };
                origimage = await s3.send(new GetObjectCommand(params));
                const ddbParams = {
                    TableName: "ImagesTable",
                    Key: {
                        'ImageName': {S: srcKey},
                    }
                };
                await ddb.send(new DeleteItemCommand(ddbParams));
                console.log(` Successfully Delete ${srcKey} from ${srcBucket} in table ${TABLE_NAME}`)
            }
        } else if (snsMessage.name) {
            const ddbParams = {
                TableName: "ImagesTable",
                Key: {
                    'ImageName': {S: snsMessage.name},
                }
            }
            await ddb.send(new DeleteItemCommand(ddbParams));
        }
        ;

    }
}

function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({region: process.env.REGION});
    const marshallOptions = {
        convertEmptyValues: true, removeUndefinedValues: true, convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
        wrapNumbers: false,
    };
    const translateConfig = {marshallOptions, unmarshallOptions};
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}

