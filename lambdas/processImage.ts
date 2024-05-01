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

const s3 = new S3Client();
const ddb = new DynamoDBClient();

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
                    throw new Error(`Unsupported file type: Files must be JPEG or PNG.`);
                }

                let origimage = null;
                try {
                    // Download the image from the S3 source bucket.
                    const params: GetObjectCommandInput = {
                        Bucket: srcBucket,
                        Key: srcKey,
                    };
                    origimage = await s3.send(new GetObjectCommand(params));
                    // Process the image ......
                    // Write item to DynamoDB
                    const ddbParams = {
                        TableName: "ImagesTable",  // Replace with your table name
                        Item: {
                            'ImageName': { S: srcKey },  // Primary key
                            'Bucket': { S: srcBucket },
                            'CreatedAt': { S: new Date().toISOString() }
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
