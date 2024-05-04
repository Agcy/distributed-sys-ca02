import {SQSHandler} from "aws-lambda";
import {
    SESClient,
    SendEmailCommand,
    SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import {SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION} from "../env";

if (!SES_EMAIL_TO || !SES_EMAIL_FROM || !SES_REGION) {
    throw new Error(
        "Please ensure SES_EMAIL_TO, SES_EMAIL_FROM, and SES_REGION environment variables are set."
    );
}

type ContactDetails = {
    name: string;
    email: string;
    message: string;
};

const client = new SESClient({region: SES_REGION});

export const handler: SQSHandler = async (event: any) => {
    console.log("Event Received: ", JSON.stringify(event));
    for (const record of event.Records) {
        // const recordBody = JSON.parse(record.body);
        // const snsMessage = JSON.parse(recordBody.Message);
        // console.log("Processing DynamoDB Record: ", JSON.stringify(snsMessage));
        if (record.eventName === 'REMOVE') { // Check if the event is a removal
            const {name, email, message}: ContactDetails = {
                name: "DynamoDB Notification System",
                email: SES_EMAIL_FROM,
                message: `An Image has been deleted from the database.`,
            };
            const params = sendEmailParams({name, email, message});
            try {
                await client.send(new SendEmailCommand(params));
            } catch (error) {
                console.log("Failed to send deletion notification email: ", error);
            }
        }
    }

};

function sendEmailParams({name, email, message}: ContactDetails) {
    const parameters: SendEmailCommandInput = {
        Destination: {
            ToAddresses: [SES_EMAIL_TO],
        },
        Message: {
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: getHtmlContent({name, email, message}),
                },
            },
            Subject: {
                Charset: "UTF-8",
                Data: "Record Deletion Alert",
            },
        },
        Source: SES_EMAIL_FROM,
    };
    return parameters;
}

function getHtmlContent({name, email, message}: ContactDetails) {
    return `
    <html>
      <body>
        <h1>Record Deletion Notification</h1>
        <h2>From: </h2>
        <ul>
          <li style="font-size:18px">👤 <b>${name}</b></li>
          <li style="font-size:18px">✉️ <b>${email}</b></li>
        </ul>
        <p style="font-size:18px">${message}</p>
      </body>
    </html> 
  `;
}
