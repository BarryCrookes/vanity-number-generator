const autoBind = require('auto-bind');
const AWS = require('aws-sdk');

const { wordsWithWeights } = require("./4LetterWordsWithWeights");
const _event = Symbol('event');

/**
 * Class to generate vanity phone numbers
 */
module.exports = class VanityNumberGenerator {

  /**
   * Constructor
   * @param {Object} event - lex event
   */
  constructor(event) {
    this[_event] = event;
    this.bind(this);
    this.demoMode = this[_event].sessionState.sessionAttributes.demoMode === 'true'
    this.customerPhoneNumber = this.demoMode
      ? this[_event].sessionState.sessionAttributes.demoPhoneNumber
      : this[_event].sessionState.sessionAttributes.customerPhoneNumber;
    this.dynamoDocumentClient = new AWS.DynamoDB.DocumentClient();
  }

  /**
   * Getter for autoBind
   */
  get bind() {
    return autoBind;
  }

  /**
   * Getter for response
   * @returns {string}
   */
  get response() {
    if(this.vanityNumbers?.length>0) {
      return `<speak>Here are you suggested vanity numbers: ${this.vanityNumberSsml}.</speak>`
    }

    return `<speak>Unfortunately, a valid vanity number could not be generated for your phone number, <say-as interpret-as="telephone">${this.customerPhoneNumber}</say-as>.</speak>`
  }

  /**
   * Getter for SSML formatted vanity numbers
   * @returns {string}
   */
  get vanityNumberSsml() {
    const ssmlSnippets = [];
    this.vanityNumbers.forEach(vanityNumber => {
      ssmlSnippets.push(`<say-as interpret-as="telephone">${vanityNumber}</say-as>`)
    })
    return ssmlSnippets.slice(0, 3).join(`<break time="1s"/>`);
  }

  /**
   * Entry point to orchestrate vanity number generation
   * @returns {Promise<{sessionState: {dialogAction: {fulfillmentState: string, type: string}, sessionAttributes: (*|LexRuntime.StringMap|LexRuntime.AttributesString|String|Record<string, string>|LexEventSessionAttributes|{[p: string]: string}), intent: (*|LexRuntimeV2.Intent|LexV2Intent|{name?: string, state: LexV2IntentState, slots?: LexV2Slots}|string)}, messages: {contentType: string, content: string}[], sessionId: *}>}
   */
  async execute() {
    await this.attemptToLoadDataForPhoneNumber();
    if(!this.vanityNumbers) {
      await this.processPhoneNumber()
    }
    return this.close();
  }

  /**
   * Set vanity numbers to previously generated numbers if they exist
   * @returns {Promise<void>}
   */
  async attemptToLoadDataForPhoneNumber () {
    const previouslySavedNumberData = await this.get();
    if(previouslySavedNumberData?.Item?.vanityNumbers) {
      this.vanityNumbers = previouslySavedNumberData.Item.vanityNumbers
    }
  }

  /**
   * Get previously saved vanity numbers from table for customer phone number
   * @returns {Promise<DocumentClient.GetItemOutput & {$response: Response<DocumentClient.GetItemOutput, Error & {code: string, message: string, retryable?: boolean, statusCode?: number, time: Date, hostname?: string, region?: string, retryDelay?: number, requestId?: string, extendedRequestId?: string, cfId?: string, originalError?: Error}>}>}
   */
  async get() {
    const params = {
      TableName: 'vanity-number-generator',
      Key: {
        phoneNumber: this.customerPhoneNumber,
      },
    };

    const getResponse = await this.dynamoDocumentClient.get(params).promise();

    return getResponse;
  };

  /**
   * Trigger vanity number generation and save if this is successful
   * @returns {Promise<void>}
   */
  async processPhoneNumber() {
    this.generateVanityNumbers();
    if(this.vanityNumbers){
      await this.save();
    }
  }

  /**
   * Generate vanity number
   * Vanity number has to replace the last 4 digits of the customer phone number with valid word
   * If the customer phone number contains '0', '1', or '+' in the last 4 digits the vanity number can't be generated
   * Each t9 letter combination for the last 4 digits will be checked against a weighted list of words
   * If no matches are found then no vanity number can be generated
   * If any matches are found, they are added to the vanity numbers list, e.g. +1800555cars' when given '+18005552277'
   */
  generateVanityNumbers() {
    const potentialVanityDigits = this.customerPhoneNumber.slice(-4);
    console.log("Potential Vanity Digits: ", potentialVanityDigits);

    if(potentialVanityDigits?.match(/(0|1|\+)+/) || potentialVanityDigits?.length != 4) {
      console.log(`Can't generate vanity number using '0', '1', or '+'`);
      return
    }

    const firstDigit = potentialVanityDigits[0];
    const secondDigit = potentialVanityDigits[1];
    const thirdDigit = potentialVanityDigits[2];
    const fourthDigit = potentialVanityDigits[3];

    const t9 = [
      ["0"],
      ["1"],
      ["a", "b", "c"],
      ["d", "e", "f"],
      ["g", "h", "i"],
      ["j", "k", "l"],
      ["m", "n", "o"],
      ["p", "q", "r", "s"],
      ["t", "u", "v"],
      ["w", "x", "y", "z" ]
    ];

    const vanityWords = [];

    t9[firstDigit].forEach(firstLetter => {
      t9[secondDigit].forEach(secondLetter => {
        t9[thirdDigit].forEach(thirdLetter => {
          t9[fourthDigit].forEach(fourthLetter => {
            const potentialWord = `${firstLetter}${secondLetter}${thirdLetter}${fourthLetter}`;
            console.log("Potential Word: ", potentialWord);
            if(wordsWithWeights[potentialWord]) {
              vanityWords.push({
                word: potentialWord,
                weight: wordsWithWeights[potentialWord]
              })
            }
          })
        })
      })
    })
    const phoneNumberStart = this.customerPhoneNumber.slice(0, this.customerPhoneNumber.length-4)

    // Sort vanity words by weight in descending order, then map to vanity number
    this.vanityNumbers = vanityWords.sort(this.byWeightDescending())
      .map(vanityWord => `${phoneNumberStart}${vanityWord.word}`)

    console.log("Vanity Numbers: ", this.vanityNumbers);
  }

  /**
   * Predicate to sort weighted words in descending order
   * @returns {function(*, *)}
   */
  byWeightDescending() {
    return (firstWord, secondWord) => secondWord.weight - firstWord.weight;
  }

  /**
   * Save the top 5 vanity number suggestion to dynamo
   * @returns {Promise<DocumentClient.PutItemOutput & {$response: Response<DocumentClient.PutItemOutput, Error & {code: string, message: string, retryable?: boolean, statusCode?: number, time: Date, hostname?: string, region?: string, retryDelay?: number, requestId?: string, extendedRequestId?: string, cfId?: string, originalError?: Error}>}>}
   */
  async save() {

    const params = {
      TableName: 'vanity-number-generator',
      Item: {
        phoneNumber: this.customerPhoneNumber,
        vanityNumbers: this.vanityNumbers.slice(0, 5),
      }
    };

    const putResponse = await this.dynamoDocumentClient.put(params).promise();
    console.log("Dynamo put response: ", JSON.stringify(putResponse));

    return putResponse;
  }

  /**
   * Read out the vanity number suggestions to the caller and end the call
   * @returns {{sessionState: {dialogAction: {fulfillmentState: string, type: string}, sessionAttributes: (*|LexRuntime.StringMap|LexRuntime.AttributesString|String|Record<string, string>|LexEventSessionAttributes|{[p: string]: string}), intent: (*|LexRuntimeV2.Intent|LexV2Intent|{name?: string, state: LexV2IntentState, slots?: LexV2Slots}|string|string)}, messages: [{contentType: string, content: string}], sessionId: *}}
   */
  close() {
    const sessionId = this[_event].sessionId;
    const currentIntent = this[_event].sessionState.intent;
    const sessionAttributes = this[_event].sessionState.sessionAttributes;

    const response = {
      messages: [
        {
          content: this.response,
          contentType: "SSML"
        }
      ],
      sessionId,
      sessionState:
        {
          dialogAction: {
            fulfillmentState: "Fulfilled",
            type: "Close"
          },
          intent: currentIntent,
          sessionAttributes
        }
    };

    return response;
  }

}
