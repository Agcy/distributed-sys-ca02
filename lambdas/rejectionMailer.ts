import {SQSHandler} from "aws-lambda";
import {SESClient, SendEmailCommand, SendEmailCommandInput} from "@aws-sdk/client-ses";
import {SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION} from "../env";

const client = new SESClient({region: SES_REGION});

type ContactDetails = {
    name: string;
    email: string;
    message: string;
};
export const handler: SQSHandler = async (event) => {
    console.log("Received event: ", JSON.stringify(event));
    for (const record of event.Records) {
        const recordBody = JSON.parse(record.body);
        const snsMessage = JSON.parse(recordBody.Message);

        if (snsMessage.Records) {
            console.log("Record body ", JSON.stringify(snsMessage));
            for (const messageRecord of snsMessage.Records) {
                const s3e = messageRecord.s3;
                const srcBucket = s3e.bucket.name;
                // Object key may have spaces or unicode non-ASCII characters.
                const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
                try {
                    const {name, email, message}: ContactDetails = {
                        name: "The Photo Album",
                        email: SES_EMAIL_FROM,
                        message: `Sorry, we rejected your Image. Its URL is s3://${srcBucket}/${srcKey}`,
                    };
                    const emailParams = sendEmailParams({name, email, message});

                    await client.send(new SendEmailCommand(emailParams));
                    console.log("Error notification email sent successfully.");
                } catch (error) {
                    console.error("Failed to send error notification email: ", error);
                    throw error;
                }
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
                Data: `Error image Upload`,
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
             <h1>Image Processing Error</h1>
             <ul>
                 <li style="font-size:18px">👤 <b>${name}</b></li>
                 <li style="font-size:18px">✉️ <b>${email}</b></li>
             </ul>
             <p style="font-size:18px">${message}</p>
         </body>
    </html>
  `;
}
