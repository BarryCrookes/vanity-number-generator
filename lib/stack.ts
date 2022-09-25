import * as lex from '@aws-cdk/aws-lex';
import {App, CfnOutput, CustomResource, Duration, RemovalPolicy, Stack as BaseStack, StackProps} from '@aws-cdk/core';
import {Effect, ManagedPolicy, Policy, PolicyStatement, Role, ServicePrincipal} from '@aws-cdk/aws-iam';
import {Function, Permission, Runtime} from '@aws-cdk/aws-lambda';
import {NodejsFunction} from '@aws-cdk/aws-lambda-nodejs';
import {CfnTable} from '@aws-cdk/aws-dynamodb/lib';
import {Provider} from '@aws-cdk/custom-resources';
import {Bucket} from '@aws-cdk/aws-s3';
import {CfnBot, CfnBotAlias, CfnBotVersion} from "@aws-cdk/aws-lex";

let id: string;

/**
 * Stack
 */
export class Stack extends BaseStack {

  static readonly LOCALE_ID = 'en_US';

  /**
   * Constructor
   * @param {Construct} scope - Scope
   * @param {String} id - Identifier
   * @param {StackProps} props - Stack properties
   */
  constructor (scope: App, idIn: string, props: StackProps) {

    super(scope, id, props);

    id = idIn;
    const region = Stack.of(this).region;
    const connectFlowFile = 'vanity-number-generator-flow';

    // ************
    // Dynamo Table
    // ************
    this.getVanityNumberDynamoTable();

    // ***
    // Bot
    // ***
    const bot = this.getBot();
    const botVersion = this.getBotVersion(bot);
    const lambda = this.getLambdaFunction();
    const botAlias = this.getBotAlias(lambda, bot, botVersion);
    const invokeLambdaPermission: Permission = {
      action: 'lambda:InvokeFunction',
      principal: new ServicePrincipal('lex.amazonaws.com'),
      sourceArn: botAlias.attrArn
    };

    lambda.addPermission('invoke-lambda-permission', invokeLambdaPermission);

    // *********
    // S3 Bucket
    // *********
    const s3Bucket = new Bucket(this, `${id}-bucket`, {
      bucketName: `${id}-bucket`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // ***************
    // Custom Resource
    // ***************
    this.getCustomResource(botAlias, bot, region, s3Bucket, connectFlowFile);

    // **************************************************
    // Link to connect flow to manually import to Connect
    // **************************************************
    const s3ConnectFlow = `https://${region}.console.aws.amazon.com/s3/object/${s3Bucket.bucketName}?region=${region}&prefix=${connectFlowFile}`

    new CfnOutput(this, `updatedConnectFlowLocation`, {
      description: "Updated connect flow that can be imported manually into connect",
      value: s3ConnectFlow
    })
  }

  getVanityNumberDynamoTable() {
    new CfnTable(this, `${id}-table`, {
      attributeDefinitions: [{
        attributeName: 'phoneNumber',
        attributeType: 'S'
      }],
      keySchema: [{
        attributeName: 'phoneNumber',
        keyType: 'HASH'
      }],
      provisionedThroughput: {
        readCapacityUnits: 1,
        writeCapacityUnits: 1
      },
      tableName: 'vanity-number-generator-table'
    });
  }

  /**
   * Returns Lex bot.
   * @returns {lex.CfnBot} Bot
   */
  getBot (): lex.CfnBot {
    const botRole = this.getBotRole();

    const bot = new lex.CfnBot(this, `${id}-bot`, {
      botLocales: [
        {
          description: `${Stack.LOCALE_ID} locale`,
          intents: [
            {
              description: 'Suggests possible vanity phone numbers for callers phone number.',
              dialogCodeHook: {
                enabled: true
              },
              fulfillmentCodeHook: {
                enabled: true
              },
              name: 'VanityNumberGenerator',
              sampleUtterances: [
                {
                  utterance: 'Yes'
                }
              ],
              slotPriorities: [
                {
                  priority: 1,
                  slotName: 'useCurrentPhoneNumber'
                }, {
                  priority: 2,
                  slotName: 'phoneNumber'
                }
              ],
              slots: [
                {
                  description: 'Confirm that current phone number should be used when generating vanity number.',
                  name: 'useCurrentPhoneNumber',
                  slotTypeName: 'AMAZON.AlphaNumeric',
                  valueElicitationSetting: {
                    promptSpecification: {
                      allowInterrupt: false,
                      maxRetries: 1,
                      messageGroupsList: [
                        {
                          message: {
                            plainTextMessage: {
                              value: 'Do you want to get vanity number suggestions for the phone number you are currently using?'
                            }
                          }
                        }
                      ]
                    },
                    slotConstraint: 'Required'
                  }
                },
                {
                  description: 'Alternative phone number provided by caller.',
                  name: 'phoneNumber',
                  slotTypeName: 'AMAZON.PhoneNumber',
                  valueElicitationSetting: {
                    promptSpecification: {
                      allowInterrupt: false,
                      maxRetries: 1,
                      messageGroupsList: [
                        {
                          message: {
                            plainTextMessage: {
                              value: 'Please enter a valid phone number?'
                            }
                          }
                        }
                      ]
                    },
                    slotConstraint: 'Required'
                  }
                }
              ]
            },
            {
              description: 'Default intent when no other intent matches',
              intentClosingSetting: {
                closingResponse: {
                  messageGroupsList: [
                    {
                      message: {
                        plainTextMessage: {
                          value: `Sorry, I can't handle alternative numbers right now. Please try again later.`
                        }
                      }
                    }
                  ]
                },
                isActive: true
              },
              name: 'FallbackIntent',
              parentIntentSignature: 'AMAZON.FallbackIntent'
            }
          ],
          localeId: Stack.LOCALE_ID,
          nluConfidenceThreshold: 0.4,
          voiceSettings: {
            voiceId: 'Joanna'
          }
        }
      ],
      dataPrivacy: {
        ChildDirected: true
      },
      description: 'Lex Chatbot that suggests possible vanity phone numbers for given phone number.',
      idleSessionTtlInSeconds: 300,
      name: `${id}-bot`,
      roleArn: botRole.roleArn
    });

    return bot;
  }

  /**
   * Returns IAM role used by Lex bot.
   * @returns {Role} IAM role for Lex bot
   */
  getBotRole (): Role {
    const role = new Role(this, `${id}-bot-role`, {
      assumedBy: new ServicePrincipal('lex.amazonaws.com')
    });

    const policy = new Policy(this, `${id}-log-policy-bot`, {
      policyName: 'Logs',
      statements: [
        new PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          effect: Effect.ALLOW,
          resources: ['arn:aws:logs:*:*:*']
        })
      ]
    });

    role.attachInlinePolicy(policy);

    return role;
  }

  /**
   * Returns bot version
   * @param bot
   */
  getBotVersion(bot: CfnBot): CfnBotVersion {
    return new lex.CfnBotVersion(this, `${id}-version-${this.getRandom()}`, {
      botId: bot.attrId,
      botVersionLocaleSpecification: [
        {
          botVersionLocaleDetails: {
            sourceBotVersion: 'DRAFT'
          },
          localeId: Stack.LOCALE_ID
        }
      ],
      description: 'Vanity Number Generator Bot Version'
    });
  }

  /**
   * Returns code hook Lambda function.
   * @returns {Function} Lambda function
   */
  getLambdaFunction (): Function { // eslint-disable-line @typescript-eslint/ban-types
    const role = this.getLambdaRole();

    return new NodejsFunction(this, `${id}-lambda`, {
      awsSdkConnectionReuse: true,
      description: 'Fulfillment Lambda for Vanity Number Generator Bot',
      entry: `src/main/lambda/lambda.js`,
      environment: {
      },
      functionName: `${id}-lambda`,
      handler: 'handler',
      memorySize: 1024, // eslint-disable-line no-magic-numbers
      role,
      runtime: Runtime.NODEJS_14_X,
      timeout: Duration.seconds(20) // eslint-disable-line no-magic-numbers
    });
  }

  /**
   * Returns IAM role used by Lambda code hook.
   * @returns {Role} IAM role for Lambda
   */
  getLambdaRole (): Role {
    const role = new Role(this, `${id}-lambda-role`, {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com')
    });

    const logPolicy = new Policy(this, `${id}-log-policy-lambda`, {
      policyName: 'Logs',
      statements: [
        new PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          effect: Effect.ALLOW,
          resources: ['arn:aws:logs:*:*:*']
        })
      ]
    });

    role.attachInlinePolicy(logPolicy);

    const dynamoPolicy = new Policy(this, `${id}-dynamo-lambda`, {
      policyName: 'Dynamo',
      statements: [
        new PolicyStatement({
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem'
          ],
          effect: Effect.ALLOW,
          resources: ['arn:aws:dynamodb:*:*:table/vanity-number-generator']
        })
      ]
    });

    role.attachInlinePolicy(dynamoPolicy);

    return role;
  }

  /**
   * Returns bot alias
   * @param lambda
   * @param bot
   * @param botVersion
   */
  getBotAlias(lambda: Function, bot: CfnBot, botVersion: CfnBotVersion) {
    return new lex.CfnBotAlias(this, `${id}-alias`, {
      botAliasLocaleSettings: [
        {
          botAliasLocaleSetting: {
            codeHookSpecification: {
              lambdaCodeHook: {
                codeHookInterfaceVersion: '1.0',
                lambdaArn: lambda.functionArn
              }
            },
            enabled: true
          },
          localeId: Stack.LOCALE_ID
        }
      ],
      botAliasName: `${id}-alias`,
      botId: bot.attrId,
      botVersion: botVersion.attrBotVersion,
      description: id
    });
  }

  /**
   * Create custom resource lambda to update and upload connect flow
   * @param botAlias
   * @param bot
   * @param region
   * @param s3Bucket
   * @param connectFlowFile
   */
  getCustomResource(botAlias: CfnBotAlias, bot: CfnBot, region: string, s3Bucket: Bucket, connectFlowFile: string) {
    const customProviderFunction = new NodejsFunction(this, `${id}-create-connect-flow`, {
      description: 'Create connect flow',
      entry: `src/main/connectFlow/createConnectFlow.js`,
      environment: {
        botAliasArn: botAlias.attrArn,
        botName: bot.name,
        region: region,
        randomTag: this.getRandom(),
        s3BucketName: s3Bucket.bucketName,
        flowName: connectFlowFile
      },
      functionName: `${id}-connect-flow-custom-resource`,
      handler: 'handler',
      memorySize: 1024, // eslint-disable-line no-magic-numbers
      role: this.getCustomResourceLambdaRole(),
      runtime: Runtime.NODEJS_14_X,
      timeout: Duration.seconds(20) // eslint-disable-line no-magic-numbers
    });
    s3Bucket.grantReadWrite(customProviderFunction);

    const provider = new Provider(this, 'ResourceProvider', {
      onEventHandler: customProviderFunction
    });

    new CustomResource(this, 'providerCustomResource', {
      serviceToken: provider.serviceToken,
      properties: {
        randomTag: this.getRandom()
      }
    });
  }

  /**
   * Returns IAM role used by Custom Resource Lambda code hook.
   * @returns {Role} IAM role for Lambda
   */
  getCustomResourceLambdaRole (): Role {
    const role = new Role(this, `${id}-custom-resource-lambda-role`, {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com')
    });

    const logPolicy = new Policy(this, `${id}-log-policy-custom-resource-lambda`, {
      policyName: 'Logs',
      statements: [
        new PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          effect: Effect.ALLOW,
          resources: ['arn:aws:logs:*:*:*']
        })
      ]
    });

    role.attachInlinePolicy(logPolicy);

    const connectPolicy = new Policy(this, `${id}-connect--custom-resource-lambda`, {
      policyName: 'Connect',
      statements: [
        new PolicyStatement({
          actions: ["iam:PutRolePolicy"],
          effect: Effect.ALLOW,
          resources: ["arn:aws:iam::*:role/aws-service-role/connect.amazonaws.com/AWSServiceRoleForAmazonConnect*"]
        })
      ]
    });

    role.attachInlinePolicy(connectPolicy);

    role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonConnect_FullAccess'))

    return role;
  }

  /**
   * Returns random string.
   * @returns {String} Random identifier
   */
  getRandom = () : string => Math.random()
    .toString(36) // eslint-disable-line no-magic-numbers
    .replace(/[^a-z]+/g, '')
    .substring(0, 5); // eslint-disable-line no-magic-numbers

}
