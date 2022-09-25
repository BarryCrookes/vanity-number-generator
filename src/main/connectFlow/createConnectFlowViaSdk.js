const {ConnectClient, CreateContactFlowCommand, AssociatePhoneNumberContactFlowCommand,
  AssociateLexBotCommand
} = require("@aws-sdk/client-connect");
const vanityNumberGeneratorFlow = require('../connectFlow/flow/vanity-number-generator-flow.json')

/**
 * Class to handle Amazon Connect integrations
 */
class Connect {

  /**
   * Constructor
   */
  constructor() {
    this.connectInstanceId = process.env.connectInstanceId;
    this.phoneNumberInstanceId = process.env.phoneNumberInstanceId;
    this.botAliasArn = process.env.botAliasArn;
    this.botName = process.env.botName;
    this.flowName = process.env.flowName || 'vanity-number-generator-flow';
    this.region = process.env.region || 'us-east-1';
    this.client = new ConnectClient({ region: this.region });
  }

  async updateContactFlow() {
    const parsedFlowTemplate = JSON.parse(JSON.stringify(vanityNumberGeneratorFlow));

    parsedFlowTemplate.modules.forEach(module => {
      if (module.type === 'GetUserInput') {

        module.parameters.forEach(parameter => {

          if (parameter.name === 'BotAliasArn') {
            parameter.value = this.botAliasArn
          }
        });
      }
    });

    this.updatedFlow = JSON.stringify(parsedFlowTemplate, null, 2);
    this.updatedFlow = parsedFlowTemplate;

    console.log("=============> updatedFlow: ", this.updatedFlow);
  }

  async createContactFlow() {
    console.log("=============> createContactFlow");
    const createContactFlowCommand = new CreateContactFlowCommand(
      {
        Content: this.updatedFlow,
        InstanceId: this.connectInstanceId,
        Name: this.flowName,
        Type: 'CONTACT_FLOW',
        Description: 'Vanity Number Generator Contact Flow',
        Tags: {
          'created-by': 'Barry Crookes'
        }
      }
    );
    console.log("=============> createContactFlowCommand: ", createContactFlowCommand);
    this.createContactFlowResponse = await this.client.send(createContactFlowCommand);

    console.log("=============> this.createContactFlowResponse: ", this.createContactFlowResponse);
  }

  async associateLexBot() {
    const associateLexBotCommand = new AssociateLexBotCommand(
      {
        InstanceId: this.connectInstanceId,
        LexBot: {
          LexRegion: this.region,
          Name: this.botName
        }
      }
    );
    this.associateLexBotResponse = await this.client.send(associateLexBotCommand);

    console.log("=============> this.associateLexBotResponse: ", this.associateLexBotResponse);
  }

  async associatePhoneNumberContactFlow() {
    const associatePhoneNumberContactFlowCommand = new AssociatePhoneNumberContactFlowCommand(
      {
        ContactFlowId: this.createContactFlowResponse.ContactFlowId,
        InstanceId: this.connectInstanceId,
        PhoneNumberId: this.phoneNumberInstanceId
      }
    );
    this.associatePhoneNumberContactFlowResponse = await this.client.send(associatePhoneNumberContactFlowCommand);
    console.log("=============> this.associatePhoneNumberContactFlowResponse: ", this.associatePhoneNumberContactFlowResponse);
  }

}

exports.handler = async () => {

  this.botAliasArn = process.env.botAliasArn;
  this.botName = process.env.botName;
  this.flowName = process.env.flowName || 'vanity-number-generator-flow';
  this.region = process.env.region || 'us-east-1';
  this.client = new ConnectClient({ region: this.region });

  try {
    const connectClient = new Connect();
    await connectClient.updateContactFlow();
    console.log("=============> connectClient.updatedFlow: ", connectClient.updatedFlow);

    if (connectClient.updatedFlow) {

      try {

        await connectClient.createContactFlow();
        await connectClient.associateLexBot();
        await connectClient.associatePhoneNumberContactFlow();

      } catch (error) {
        console.log("=============> JSON.stringify(error): ", JSON.stringify(error));
        const { requestId, cfId, extendedRequestId } = error.$metadata;
        console.log({ requestId, cfId, extendedRequestId });
      }
    }

    console.log(`=============> Custom Resource Success: ${connectClient.flowName}, ${connectClient.botAliasArn}`);

  } catch (e) {
    console.error('Custom Resource Error', e);
  }

}

