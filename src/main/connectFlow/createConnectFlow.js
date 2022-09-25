const { S3 } = require('aws-sdk')
const vanityNumberGeneratorFlow = require('../connectFlow/flow/vanity-number-generator-flow.json')

/**
 * Get connect flow and update the BotAliasArn
 * @returns {Promise<string>}
 */
async function updateContactFlow() {

  const updatedFlow = JSON.parse(JSON.stringify(vanityNumberGeneratorFlow));

  updatedFlow.modules.forEach(module => {
    if (module.type === 'GetUserInput') {

      module.parameters.forEach(parameter => {

        if (parameter.name === 'BotAliasArn') {
          parameter.value = process.env.botAliasArn
        }
      });
    }
  });

  return JSON.stringify(updatedFlow, null, 2);
}

/**
 * Trigger connect flow update and uploads file to s3 bucket
 * @returns {Promise<S3.PutObjectOutput & {$response: Response<S3.PutObjectOutput, Error & {code: string, message: string, retryable?: boolean, statusCode?: number, time: Date, hostname?: string, region?: string, retryDelay?: number, requestId?: string, extendedRequestId?: string, cfId?: string, originalError?: Error}>}>}
 */
exports.handler = async () => {

  try {
    const updatedContactFlow = await updateContactFlow();
    console.log("=============> updatedContactFlow: ", updatedContactFlow);

    if (updatedContactFlow) {

      try {

        const s3 = new S3();

        const putObjectParams = {
          Bucket: process.env.s3BucketName,
          Key: process.env.flowName,
          ContentType: 'application/json',
          Body: Buffer.from(updatedContactFlow)
        };

        const result = await s3.putObject(putObjectParams).promise();

        return result;

      } catch (error) {
        console.log("=============> JSON.stringify(error): ", JSON.stringify(error));
      }

    }

    console.log(`Custom Resource Success: s3BucketName=${process.env.s3BucketName}, flowName=${process.env.flowName}, botAliasArn=${process.env.botAliasArn}`);

  } catch (e) {
    console.error(`Custom Resource Error: s3BucketName=${process.env.s3BucketName}, flowName=${process.env.flowName}, botAliasArn=${process.env.botAliasArn}`, e);
  }

}

