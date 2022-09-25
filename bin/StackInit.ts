import { Stack } from '../lib/stack';
import { App } from '@aws-cdk/core';

const app = new App();

/**
 * Initalise the stack
 */
new Stack(app, "vanity-number-generator", {
  stackName: "vanity-number-generator",
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  }
});
