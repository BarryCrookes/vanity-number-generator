# vanity-number-generator
Suggest possible vanity phone numbers for callers phone number.

Try it out by calling **+44 800 032 1362**.

Note, with this implementation, not every phone number will have a potential vanity number. If a vanity number can't be generated for your phone number you will get a message saying so.

You can manually override your phone number in the Connect flow by setting `useDemo` to `true` in the `Get Customer Input` block. This will allow the `demoPhoneNumber` value to be used.  

## Deploying

### Prerequisites
- Install and bootstrap the AWS CDK. Instructions can be found [here](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_prerequisites).
- Amazon Connect instance

### Deploy steps
- `npm install` - install node dependencies
- `npm test` - runs jasmine tests with coverage by nyc
- `npm run deploy` - compile and webpack, then deploy cdk

### Importing Connect flow
- Add bot so that it can be used within Connect
  - Amazon Connect > Contact flows
  - Under `Amazon Lex`
    - Select `vanity-number-generator-bot` from the `Bot` dropdown
    - Select `vanity-number-generator-alias` from the `Alias` dropdown
    - Click ` Add Amazon Lex Bot` button
- Import flow
  - Launch Amazon Connect console
  - Select `Contact flows` from the `Routing` menu on the left
  - Click `Create contact flow` button on top right of `Contact flows` screen
  - Select `Import flow (bets)` from the `Save` drop down
  - Select flow you wish to use (link from generated flow will be shown in the terminal when you deploy the code. Follow that link and download the file so you can use it here)
  - Click `Import` button
  - Click `Publish` button
- Add phone number to flow
  - Select `Phone numbers` from the `Channells` menu on the left
  - Click `Claim a number` button on top right of `Manage phone numbers` screen
  - Select you local country from the `Country` drop down and select the first number that it suggests
  - Under `Optional information`, select `vanity-number-generator-flow` from the `Contact flow / IVR` drop down
  - Click `Save` button

### Cleanup 
Don't forget to clean up your environment when you are done using the deployed code. Run the following command to delete the stack:

```cdk destroy vanity-number-generator```

Also, release your phone number in the Connect console so that it is freed up for someone else to use.

## Solution description
### Architecture
![Architecture Diagram](Architecture%20Diagram.png)
- Without formal requirements defining what a vanity number should be, I decided on using the last 4 digits of the callers phone number.
- The lambda function generates every possible combination of letters for these 4 digits and checks if they form a valid word using a list of around 300,000 of the most frequently used english words.
- The top 5 words, based on frequency weight, are saved to a DynamoDB table, with the top 3  words being read out to the caller.
- If the caller has already called then the previously saved values are retrieved from the table instead of generating them again.
- If fewer than 3 vanity numbers can be generated for the callers number, all available options will be stored and read tp the caller.
- If no vanity numbers can be generated then the caller will be informed and asked to try again later. Trying again will currently give the same message, but we could potentially add to the list of available words in the future.
- The solution only really requires a lambda to be able to generate the vanity numbers, but I decided to integrate the lambda with a Lex chat bot. This gives us the ability to interact with the caller and a future improvement could be to let the caller say a different phone number to use when generating the vanity number.  

### Resource Deployment
![Deployed Resources](Deployed%20Resources.png)
Using CDK, I deploy the DynamoDB table first.</br>
Next, the Lex bot is deployed. I've included 1 Intent that fulfilled by lambda code, and a fallback intent that will catch when the caller says "No" to our initial prompt any unrecognised utterances.</br>
A lambda is created and given permission to get and put to the DynamoDB table created in the first step. I also create a bot alias and set the lambda as the fulfillment code hook. Then I give lex the permission to trigger the lambda.</br>
Now I create an s3 bucket that will be used to store an updated Amazon Connect Contact Flow file, which will be manually imported into Connect later.</br>  
A custom resource is created. This is backed by a lambda that reads an Amazon Connect Contact flow template and updates the bot ARN with the ARN or the deployed bot. The lambda then put the updated flow file to the s3 bucket. This lambda is granted permissions to read/write to the bucket.</br>
Finally a link to the updated contact flow is output to speed up manual import of the flow.

## Other consideration
### Connect APIs
I tried to update the Amazon Connect flow programmatically using `@aws-sdk/client-connect` within the custom resource, but I kept getting access denied exception:
```
{
    "name": "AccessDeniedException",
    "$fault": "client",
    "$metadata": {
    "httpStatusCode": 403,
    "requestId": "aad697ba-b8e4-49f0-86c3-3ab5f6715324",
    "attempts": 1,
    "totalRetryDelay": 0
    },
    "message": "User: arn:aws:sts::090873815259:assumed-role/vanity-number-generator-vanitynumbergeneratorcusto-13766CUWCI66C/vanity-number-generator-connect-flow-custom-resource is not authorized to perform: connect:* on resource: * with an explicit deny"
}
```

The IAM role for the lambda grants access to `connect:*` via the `AmazonConnect_FullAccess` managed policy, following instruction outlined [here](https://docs.aws.amazon.com/connect/latest/adminguide/security-iam-amazon-connect-permissions.html). </br>
I don't have access to AWS support from my free account, so I couldn't take this path any further.

This lead me to the less desirable, but functional, decision of a semi-automated process to update the Connect flow with the correct bot alias and then upload it to s3 from the custom resource. This can then be manually imported into Connect.

### Unigram Package
- Unigram package
  - includes 'The 1/3 million most frequent words, all lowercase, with counts.'
  - limiting to words of a certain length really restricted the number of potential words
    - 3 - 672 words
    - 4 - 1125 (1126 when I manually added another after deciding on this length)
    - 5 - 1382 words
  - generating vanity numbers with so few words proved difficult
  - Had to manually add a row to my dictionary to get 5 words to match
    - ```"baps": "5070185"```

### T9 Node Packages
I tried to use `t9` and `t9-plus` node packages to generate the vanity words but they give predictions of words which include fixing potential typos. THis meant it could give words for numbers that I didn't provide.


They also had the same limitation of words as I faced, as you have to provide them with the word list to use.

## Improvements

### Vanity number generation
- More complex logic to generate better vanity numbers
- Let caller provide alternate phone number
- Let the caller define the length on the vanity number

### Coding standards
- Commonly used code should be extracted into util packages
- Better error handling
- Input data validation

### CDK Structure
I would like to split each resource into separate nested stacks. I believe this would help with the readability of the final cdk code but would've taken extra time to implement.

### Tests
There are some unit tests included, but we really should have a more comprehensive test suite including:
- Local integration tests using `lambda-local` to trigger the lambda 
- Integration tests using `Cyara` to call the Connect flow phone number
- CDK tests using `@aws-cdk/assert` to test the stack definitions

### Security
All resources in the stack have restricted access to only the actions they need to use.

We could also protect the Connect flow from being attacked by malicious callers hammering the phone line by:
- identify callers
- restrict what phone numbers allowed to call the flow

### Lambda Layer
Node packages could be moved to a lambda layer to improve lambda load times, decrease artifact size, and share code with other lambdas. 

### Connect deploy via CDK
An alternative to the custom resource option would be to use CDK to configure Connect.
