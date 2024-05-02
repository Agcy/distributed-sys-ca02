import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

import {Construct} from "constructs";

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class EDAAppStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const imagesBucket = new s3.Bucket(this, "images", {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            publicReadAccess: false,
        });

        // create table
        const imagesTable = new dynamodb.Table(this, "imagesTable", {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: {name: "imageName", type: dynamodb.AttributeType.STRING},
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            tableName: "Images",
        })
        // Output

        new cdk.CfnOutput(this, "bucketName", {
            value: imagesBucket.bucketName,
        });

        // Create the DLQ
        const imageProcessingDLQ = new sqs.Queue(this, "img-processing-DLQ", {
            receiveMessageWaitTime: cdk.Duration.seconds(10),
        });

        // Integration infrastructure

        const imageProcessQueue = new sqs.Queue(this, "img-created-queue", {
            receiveMessageWaitTime: cdk.Duration.seconds(10),
            deadLetterQueue: {
                queue: imageProcessingDLQ,
                maxReceiveCount: 5
            }
        });

        const mailerQ = new sqs.Queue(this, "mailer-queue", {
            receiveMessageWaitTime: cdk.Duration.seconds(10),
        });

        const rejectionMailerQ = new sqs.Queue(this, "rejection-mailer-queue", {
            receiveMessageWaitTime: cdk.Duration.seconds(10),
            deadLetterQueue: {
                queue: imageProcessingDLQ,
                maxReceiveCount: 5
            }
        });

        const newImageTopic = new sns.Topic(this, "new-image-topic", {
            displayName: "New Image topic",
        });

        // delete and update SNS topics
        const deleteImageTopic = new sns.Topic(this, "delete-image-topic", {
            displayName: "Delete Image Topic"
        });
        const updateDescriptionTopic = new sns.Topic(this, "update-description-topic", {
            displayName: "Update Description Topic"
        });


        // Lambda functions

        const processImageFn = new lambdanode.NodejsFunction(
            this,
            "ProcessImageFn",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                entry: `${__dirname}/../lambdas/processImage.ts`,
                timeout: cdk.Duration.seconds(15),
                memorySize: 128,
                environment: {
                    TABLE_NAME: imagesTable.tableName,
                    REGION: 'eu-west-1',
                }
            }
        );

        const processDeleteFn = new lambdanode.NodejsFunction(
            this,
            "ProcessDeleteFunction", {
                runtime: lambda.Runtime.NODEJS_16_X,
                entry: `${__dirname}/../lambdas/processDelete.ts`, // Ensure the path is correct
                handler: 'handler',
                timeout: cdk.Duration.seconds(15),
                memorySize: 128,
                environment: {
                    TABLE_NAME: imagesTable.tableName,
                    REGION: 'eu-west-1',
                }
            }
        );

        const mailerFn = new lambdanode.NodejsFunction(this, "mailer-function", {
            runtime: lambda.Runtime.NODEJS_16_X,
            memorySize: 1024,
            timeout: cdk.Duration.seconds(3),
            entry: `${__dirname}/../lambdas/mailer.ts`,
        });

        const rejectionMailerFn = new lambdanode.NodejsFunction(this, "rejection-mailer-function", {
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/../lambdas/rejectionMailer.ts`,
            timeout: cdk.Duration.seconds(3),
            memorySize: 1024,
        });

        // S3 --> SQS
        imagesBucket.addEventNotification(
            s3.EventType.OBJECT_CREATED,
            new s3n.SnsDestination(newImageTopic)  // Changed
        );

        newImageTopic.addSubscription(
            new subs.SqsSubscription(imageProcessQueue)
        );

        newImageTopic.addSubscription(new subs.SqsSubscription(mailerQ));

        // SQS --> Lambda
        const newImageEventSource = new events.SqsEventSource(imageProcessQueue, {
            batchSize: 5,
            maxBatchingWindow: cdk.Duration.seconds(10),
        });

        const newImageMailEventSource = new events.SqsEventSource(mailerQ, {
            batchSize: 5,
            maxBatchingWindow: cdk.Duration.seconds(10),
        });

        const rejectedImageMailEventSource = new events.SqsEventSource(imageProcessingDLQ, {
            batchSize: 5,
            maxBatchingWindow: cdk.Duration.seconds(10),
        })

        processImageFn.addEventSource(newImageEventSource);
        mailerFn.addEventSource(newImageMailEventSource);
        rejectionMailerFn.addEventSource(rejectedImageMailEventSource);

        // Permissions

        imagesBucket.grantRead(processImageFn);

        mailerFn.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    "ses:SendEmail",
                    "ses:SendRawEmail",
                    "ses:SendTemplatedEmail",
                ],
                resources: ["*"],
            })
        );

        rejectionMailerFn.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    "ses:SendEmail",
                    "ses:SendRawEmail",
                    "ses:SendTemplatedEmail",
                ],
                resources: ["*"],
            })
        );

        imagesTable.grantReadWriteData(processImageFn)
        imagesTable.grantReadWriteData(processDeleteFn)

        // Output

        new cdk.CfnOutput(this, "edastack-images9bf4dcd5-85uahqmsnn1v", {
            value: imagesBucket.bucketName,
        });

        new cdk.CfnOutput(this, "deleteImageTopicArn", {
            value: deleteImageTopic.topicArn,
            exportName: "deleteImageTopicArn"
        });

        new cdk.CfnOutput(this, "updateDescriptionTopicArn", {
            value: updateDescriptionTopic.topicArn,
            exportName: "updateDescriptionTopicArn"
        });
    }
}
