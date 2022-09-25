const VanityNumberGenerator = require('../../main/lambda/VanityNumberGenerator');
const eventTemplate = require('./event');
const expectedResponseTemplate = require('./expectedResponse');
const AwsMock = require('aws-sdk-mock');

describe('Vanity Number Generator', () => {

  beforeAll(() => {
    process.env.AWS_REGION = 'us-east-1';
  });

  afterEach(() => {
    AwsMock.restore();
  });

  afterAll(() => {
    delete process.env.region;
  });

  describe('Error', () => {

    it(`should tell caller that vanity number couldn't be generated if last 4 digits contains '0', '1', or '+'`, async () => {

      const invalidPhoneNumber = '12345678901';

      const event = JSON.parse(JSON.stringify(eventTemplate));
      event.sessionState.sessionAttributes.customerPhoneNumber = invalidPhoneNumber;

      const expectedResponse = JSON.parse(JSON.stringify(expectedResponseTemplate));
      expectedResponse.messages[0].content = `<speak>Unfortunately, a valid vanity number could not be generated for your phone number, <say-as interpret-as="telephone">${invalidPhoneNumber}</say-as>.</speak>`
      expectedResponse.sessionState.sessionAttributes.customerPhoneNumber = invalidPhoneNumber;

      const vanityNumberGenerator = new VanityNumberGenerator(event);
      const response = await vanityNumberGenerator.execute()

      expect(response).toEqual(expectedResponse);
    });

    it(`should tell caller that vanity number couldn't be generated if no words can be generated for their phone number`, async () => {

      const invalidPhoneNumber = '12345679999';

      const event = JSON.parse(JSON.stringify(eventTemplate));
      event.sessionState.sessionAttributes.customerPhoneNumber = invalidPhoneNumber;

      const expectedResponse = JSON.parse(JSON.stringify(expectedResponseTemplate));
      expectedResponse.messages[0].content = `<speak>Unfortunately, a valid vanity number could not be generated for your phone number, <say-as interpret-as="telephone">${invalidPhoneNumber}</say-as>.</speak>`
      expectedResponse.sessionState.sessionAttributes.customerPhoneNumber = invalidPhoneNumber;

      const vanityNumberGenerator = new VanityNumberGenerator(event);
      const response = await vanityNumberGenerator.execute()

      expect(response).toEqual(expectedResponse);
    });

  });

  describe('Success', () => {

    it(`should use previously generated vanity numbers for phone number if they exist in table`, async () => {

      const event = JSON.parse(JSON.stringify(eventTemplate));
      const expectedResponse = JSON.parse(JSON.stringify(expectedResponseTemplate));
      expectedResponse.messages[0].content = `<speak>Here are you suggested vanity numbers: `+
        `<say-as interpret-as="telephone">+1800555prea</say-as><break time="1s"/>`+
        `<say-as interpret-as="telephone">+1800555preb</say-as><break time="1s"/>`+
        `<say-as interpret-as="telephone">+1800555prec</say-as>.</speak>`

      AwsMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
        const expectedParams = {
          TableName: 'vanity-number-generator',
          Key: {
            phoneNumber: '+18005556789',
          }
        }
        expect(params).toEqual(expectedParams);
        return callback(null, {
          Item: {
            phoneNumber: '+18005556789',
            vanityNumbers: ['+1800555prea', '+1800555preb', '+1800555prec', '+1800555pred', '+1800555pree'],
          }
        });
      });

      const vanityNumberGenerator = new VanityNumberGenerator(event);
      const response = await vanityNumberGenerator.execute()

      expect(response).toEqual(expectedResponse);
    });

    it(`should read out all available vanity numbers if fewer than 3 could be generated`, async () => {

      const event = JSON.parse(JSON.stringify(eventTemplate));
      const expectedResponse = JSON.parse(JSON.stringify(expectedResponseTemplate));
      expectedResponse.messages[0].content = `<speak>Here are you suggested vanity numbers: `+
        `<say-as interpret-as="telephone">+1800555prea</say-as><break time="1s"/>`+
        `<say-as interpret-as="telephone">+1800555preb</say-as>.</speak>`


      AwsMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
        const expectedParams = {
          TableName: 'vanity-number-generator',
          Key: {
            phoneNumber: '+18005556789',
          }
        }
        expect(params).toEqual(expectedParams);
        return callback(null, {
          Item: {
            phoneNumber: '+18005556789',
            vanityNumbers: ['+1800555prea', '+1800555preb'],
          }
        });
      });

      const vanityNumberGenerator = new VanityNumberGenerator(event);
      const response = await vanityNumberGenerator.execute()

      expect(response).toEqual(expectedResponse);
    });

    it(`should tell caller a maximum of 3 potential vanity numbers when valid phone number is provided`, async () => {

      const phoneNumber = '+12345672277';

      const event = JSON.parse(JSON.stringify(eventTemplate));
      event.sessionState.sessionAttributes.customerPhoneNumber = phoneNumber;

      const expectedResponse = JSON.parse(JSON.stringify(expectedResponseTemplate));
      expectedResponse.sessionState.sessionAttributes.customerPhoneNumber = phoneNumber;
      expectedResponse.messages[0].content = `<speak>Here are you suggested vanity numbers: `+
        `<say-as interpret-as="telephone">+1234567cars</say-as><break time="1s"/>`+
        `<say-as interpret-as="telephone">+1234567bars</say-as><break time="1s"/>`+
        `<say-as interpret-as="telephone">+1234567bass</say-as>.</speak>`

      AwsMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {

        const expectedParams = {
          TableName: 'vanity-number-generator',
          Key: {
            phoneNumber: phoneNumber,
          }
        }

        expect(params).toEqual(expectedParams);

        return callback(null, {});
      });

      AwsMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {

        const expectedParams = {
          TableName: 'vanity-number-generator',
          Item: {
            phoneNumber: phoneNumber,
            vanityNumbers: [ '+1234567cars', '+1234567bars', '+1234567bass', '+1234567caps', '+1234567baps' ],
          }
        }

        expect(params).toEqual(expectedParams);

        return callback(null, {});
      });

      const vanityNumberGenerator = new VanityNumberGenerator(event);
      const response = await vanityNumberGenerator.execute()

      expect(response).toEqual(expectedResponse);
    });

    it(`should use 'demoPhoneNumber' session attribute if 'demoMode' session attribute is 'true'`, async () => {

      const event = JSON.parse(JSON.stringify(eventTemplate));
      event.sessionState.sessionAttributes.demoMode = 'true';

      const phoneNumber = event.sessionState.sessionAttributes.demoPhoneNumber;

      const expectedResponse = JSON.parse(JSON.stringify(expectedResponseTemplate));
      expectedResponse.sessionState.sessionAttributes.demoMode = 'true'
      expectedResponse.messages[0].content = `<speak>Here are you suggested vanity numbers: `+
        `<say-as interpret-as="telephone">+1800555cars</say-as><break time="1s"/>`+
        `<say-as interpret-as="telephone">+1800555bars</say-as><break time="1s"/>`+
        `<say-as interpret-as="telephone">+1800555bass</say-as>.</speak>`

      AwsMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {

        const expectedParams = {
          TableName: 'vanity-number-generator',
          Key: {
            phoneNumber: phoneNumber,
          }
        }

        expect(params).toEqual(expectedParams);

        return callback(null, {});
      });

      AwsMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {

        const expectedParams = {
          TableName: 'vanity-number-generator',
          Item: {
            phoneNumber: phoneNumber,
            vanityNumbers: [ '+1800555cars', '+1800555bars', '+1800555bass', '+1800555caps', '+1800555baps' ],
          }
        }

        expect(params).toEqual(expectedParams);

        return callback(null, {});
      });

      const vanityNumberGenerator = new VanityNumberGenerator(event);
      const response = await vanityNumberGenerator.execute()

      expect(response).toEqual(expectedResponse);
    });

  });

});
