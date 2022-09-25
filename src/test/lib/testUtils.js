/*
 * Copyright (C) 2021, Liberty Mutual Group
 *
 */

/* eslint-disable no-invalid-this, object-curly-newline, camelcase */
/* eslint-disable  @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */

const lambdaLocal = require('lambda-local');

const environmentVariables = {
  ACCOUNT_ENV: 'dev',
  APP_VERSION: '1.0.0',
  AWS_NODEJS_CONNECTION_REUSE_ENABLED: 1,
  BOT_NAME: 'cct_shared_intent_bot',
  DEBUG_MODE: 'dev',
  INTENT_TYPE: 'V',
  LAMBDA_NAME: 'cct-shared-intent-bot-handler',
};

/**
 * Takes an object, and removes each of its keys from the environment variables
 */
exports.cleanUpEnvironmentVariables = () => {
  if (environmentVariables) {
    Object.keys(environmentVariables).forEach(key => delete process.env[key]);
  }
};

/**
 * Takes an object with keys and values, and sets each key as an environment variable with the specified value
 */
exports.initialiseEnvironmentVariables = () => {
  if (environmentVariables) {
    Object.keys(environmentVariables).forEach(key => {
      process.env[key] = environmentVariables[key];
    });
  }
};

/* eslint-disable object-curly-newline, max-params */
/**
 * Directly executes passed lambda function.
 * @param {Function} lambda Lambda
 * @param {Object} event Event
 * @param {Function} callback Callback
 * @param {Object} [options] Supports callbackWaitsForEmptyEventLoop, lambdaHandler and timeoutMs
 * @returns {Promise<unknown>} lambda execution promise
 */
exports.executeLambda =(lambda, event, callback, options = {}) => {
  /* eslint-enable object-curly-newline, max-params */

  const timeout = 10000;

  return lambdaLocal.execute({
    callback,
    callbackWaitsForEmptyEventLoop: options.callbackWaitsForEmptyEventLoop || true,
    event,
    lambdaFunc: lambda,
    lambdaHandler: options.lambdaHandler || 'handler',
    timeoutMs: options.timeoutMs || timeout
  });
};
//
// /**
//  * Mocks jasmine clock with given date
//  * Default to 'Jan 23 2021 01:23:45 GMT-0500'
//  * @param {Date} [baseTime] - Base time
//  */
// exports.mockClock = (baseTime = new Date('Jan 23 2021 01:23:45 GMT-0500')) => {
//   jasmine.clock().install();
//   jasmine.clock().mockDate(baseTime);
// };
//
// /**
//  * Uninstall the mock jasmine clock
//  */
// exports.uninstallMockClock = () => {
//   jasmine.clock().uninstall();
// };

exports.copy = (object) => JSON.parse(JSON.stringify(object));
