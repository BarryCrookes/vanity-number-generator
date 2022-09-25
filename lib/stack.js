"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stack = void 0;
const lex = __importStar(require("@aws-cdk/aws-lex"));
const core_1 = require("@aws-cdk/core");
const aws_iam_1 = require("@aws-cdk/aws-iam");
const aws_lambda_1 = require("@aws-cdk/aws-lambda");
const aws_lambda_nodejs_1 = require("@aws-cdk/aws-lambda-nodejs");
const lib_1 = require("@aws-cdk/aws-dynamodb/lib");
const custom_resources_1 = require("@aws-cdk/custom-resources");
const aws_s3_1 = require("@aws-cdk/aws-s3");
let id;
/**
 * Stack
 */
class Stack extends core_1.Stack {
    /**
     * Constructor
     * @param {Construct} scope - Scope
     * @param {String} id - Identifier
     * @param {StackProps} props - Stack properties
     */
    constructor(scope, idIn, props) {
        super(scope, id, props);
        /**
         * Returns random string.
         * @returns {String} Random identifier
         */
        this.getRandom = () => Math.random()
            .toString(36) // eslint-disable-line no-magic-numbers
            .replace(/[^a-z]+/g, '')
            .substring(0, 5); // eslint-disable-line no-magic-numbers
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
        const invokeLambdaPermission = {
            action: 'lambda:InvokeFunction',
            principal: new aws_iam_1.ServicePrincipal('lex.amazonaws.com'),
            sourceArn: botAlias.attrArn
        };
        lambda.addPermission('invoke-lambda-permission', invokeLambdaPermission);
        // *********
        // S3 Bucket
        // *********
        const s3Bucket = new aws_s3_1.Bucket(this, `${id}-bucket`, {
            bucketName: `${id}-bucket`,
            removalPolicy: core_1.RemovalPolicy.DESTROY,
            autoDeleteObjects: true
        });
        // ***************
        // Custom Resource
        // ***************
        this.getCustomResource(botAlias, bot, region, s3Bucket, connectFlowFile);
        // **************************************************
        // Link to connect flow to manually import to Connect
        // **************************************************
        const s3ConnectFlow = `https://${region}.console.aws.amazon.com/s3/object/${s3Bucket.bucketName}?region=${region}&prefix=${connectFlowFile}`;
        new core_1.CfnOutput(this, `updatedConnectFlowLocation`, {
            description: "Updated connect flow that can be imported manually into connect",
            value: s3ConnectFlow
        });
    }
    getVanityNumberDynamoTable() {
        new lib_1.CfnTable(this, `${id}-table`, {
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
            tableName: 'vanity-number-generator'
        });
    }
    /**
     * Returns Lex bot.
     * @returns {lex.CfnBot} Bot
     */
    getBot() {
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
    getBotRole() {
        const role = new aws_iam_1.Role(this, `${id}-bot-role`, {
            assumedBy: new aws_iam_1.ServicePrincipal('lex.amazonaws.com')
        });
        const policy = new aws_iam_1.Policy(this, `${id}-policy-log-bot`, {
            policyName: 'Logs',
            statements: [
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'logs:CreateLogGroup',
                        'logs:CreateLogStream',
                        'logs:PutLogEvents'
                    ],
                    effect: aws_iam_1.Effect.ALLOW,
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
    getBotVersion(bot) {
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
    getLambdaFunction() {
        const role = this.getLambdaRole();
        return new aws_lambda_nodejs_1.NodejsFunction(this, `${id}-lambda`, {
            awsSdkConnectionReuse: true,
            description: 'Fulfillment Lambda for Vanity Number Generator Bot',
            entry: `src/main/lambda/lambda.js`,
            environment: {},
            functionName: `${id}-lambda`,
            handler: 'handler',
            memorySize: 1024,
            role,
            runtime: aws_lambda_1.Runtime.NODEJS_14_X,
            timeout: core_1.Duration.seconds(20) // eslint-disable-line no-magic-numbers
        });
    }
    /**
     * Returns IAM role used by Lambda code hook.
     * @returns {Role} IAM role for Lambda
     */
    getLambdaRole() {
        const role = new aws_iam_1.Role(this, `${id}-lambda-role`, {
            assumedBy: new aws_iam_1.ServicePrincipal('lambda.amazonaws.com')
        });
        const logPolicy = new aws_iam_1.Policy(this, `${id}-policy-log-lambda`, {
            policyName: 'Logs',
            statements: [
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'logs:CreateLogGroup',
                        'logs:CreateLogStream',
                        'logs:PutLogEvents'
                    ],
                    effect: aws_iam_1.Effect.ALLOW,
                    resources: ['arn:aws:logs:*:*:*']
                })
            ]
        });
        role.attachInlinePolicy(logPolicy);
        const dynamoPolicy = new aws_iam_1.Policy(this, `${id}-dynamo-lambda`, {
            policyName: 'Dynamo',
            statements: [
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'dynamodb:GetItem',
                        'dynamodb:PutItem',
                        'dynamodb:UpdateItem'
                    ],
                    effect: aws_iam_1.Effect.ALLOW,
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
    getBotAlias(lambda, bot, botVersion) {
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
    getCustomResource(botAlias, bot, region, s3Bucket, connectFlowFile) {
        const customProviderFunction = new aws_lambda_nodejs_1.NodejsFunction(this, `${id}-create-connect-flow`, {
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
            memorySize: 1024,
            role: this.getCustomResourceLambdaRole(),
            runtime: aws_lambda_1.Runtime.NODEJS_14_X,
            timeout: core_1.Duration.seconds(20) // eslint-disable-line no-magic-numbers
        });
        s3Bucket.grantReadWrite(customProviderFunction);
        const provider = new custom_resources_1.Provider(this, 'ResourceProvider', {
            onEventHandler: customProviderFunction
        });
        new core_1.CustomResource(this, 'providerCustomResource', {
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
    getCustomResourceLambdaRole() {
        const role = new aws_iam_1.Role(this, `${id}-custom-resource-lambda-role`, {
            assumedBy: new aws_iam_1.ServicePrincipal('lambda.amazonaws.com')
        });
        const logPolicy = new aws_iam_1.Policy(this, `${id}-log-policy-custom-resource-lambda`, {
            policyName: 'Logs',
            statements: [
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'logs:CreateLogGroup',
                        'logs:CreateLogStream',
                        'logs:PutLogEvents'
                    ],
                    effect: aws_iam_1.Effect.ALLOW,
                    resources: ['arn:aws:logs:*:*:*']
                })
            ]
        });
        role.attachInlinePolicy(logPolicy);
        const connectPolicy = new aws_iam_1.Policy(this, `${id}-connect--custom-resource-lambda`, {
            policyName: 'Connect',
            statements: [
                new aws_iam_1.PolicyStatement({
                    actions: ["iam:PutRolePolicy"],
                    effect: aws_iam_1.Effect.ALLOW,
                    resources: ["arn:aws:iam::*:role/aws-service-role/connect.amazonaws.com/AWSServiceRoleForAmazonConnect*"]
                })
            ]
        });
        role.attachInlinePolicy(connectPolicy);
        role.addManagedPolicy(aws_iam_1.ManagedPolicy.fromAwsManagedPolicyName('AmazonConnect_FullAccess'));
        return role;
    }
}
exports.Stack = Stack;
Stack.LOCALE_ID = 'en_US';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsc0RBQXdDO0FBQ3hDLHdDQUFzSDtBQUN0SCw4Q0FBd0c7QUFDeEcsb0RBQWtFO0FBQ2xFLGtFQUEwRDtBQUMxRCxtREFBbUQ7QUFDbkQsZ0VBQW1EO0FBQ25ELDRDQUF1QztBQUd2QyxJQUFJLEVBQVUsQ0FBQztBQUVmOztHQUVHO0FBQ0gsTUFBYSxLQUFNLFNBQVEsWUFBUztJQUlsQzs7Ozs7T0FLRztJQUNILFlBQWEsS0FBVSxFQUFFLElBQVksRUFBRSxLQUFpQjtRQUV0RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQWthMUI7OztXQUdHO1FBQ0gsY0FBUyxHQUFHLEdBQVksRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUU7YUFDckMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLHVDQUF1QzthQUNwRCxPQUFPLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQzthQUN2QixTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsdUNBQXVDO1FBdmF6RCxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQ1YsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFDckMsTUFBTSxlQUFlLEdBQUcsOEJBQThCLENBQUM7UUFFdkQsZUFBZTtRQUNmLGVBQWU7UUFDZixlQUFlO1FBQ2YsSUFBSSxDQUFDLDBCQUEwQixFQUFFLENBQUM7UUFFbEMsTUFBTTtRQUNOLE1BQU07UUFDTixNQUFNO1FBQ04sTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQzFCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDM0MsTUFBTSxN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QkFBa0IsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUV2QyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsdUJBQWEsQ0FBQyx3QkFBd0IsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUE7UUFFekYsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDOztBQTVhSCxzQkF1YkM7QUFyYmlCLGVBQVMsR0FBRyxPQUFPLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBsZXggZnJvbSAnQGF3cy1jZGsvYXdzLWxleCc7XG5pbXBvcnQge0FwcCwgQ2ZuT3V0cHV0LCBDdXN0b21SZXNvdXJjZSwgRHVyYXRpb24sIFJlbW92YWxQb2xpY3ksIFN0YWNrIGFzIEJhc2VTdGFjaywgU3RhY2tQcm9wc30gZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQge0VmZmVjdCwgTWFuYWdlZFBvbGljeSwgUG9saWN5LCBQb2xpY3lTdGF0ZW1lbnQsIFJvbGUsIFNlcnZpY2VQcmluY2lwYWx9IGZyb20gJ0Bhd3MtY2RrL2F3cy1pYW0nO1xuaW1wb3J0IHtGdW5jdGlvbiwgUGVybWlzc2lvbiwgUnVudGltZX0gZnJvbSAnQGF3cy1jZGsvYXdzLWxhbWJkYSc7XG5pbXBvcnQge05vZGVqc0Z1bmN0aW9ufSBmcm9tICdAYXdzLWNkay9hd3MtbGFtYmRhLW5vZGVqcyc7XG5pbXBvcnQge0NmblRhYmxlfSBmcm9tICdAYXdzLWNkay9hd3MtZHluYW1vZGIvbGliJztcbmltcG9ydCB7UHJvdmlkZXJ9IGZyb20gJ0Bhd3MtY2RrL2N1c3RvbS1yZXNvdXJjZXMnO1xuaW1wb3J0IHtCdWNrZXR9IGZyb20gJ0Bhd3MtY2RrL2F3cy1zMyc7XG5pbXBvcnQge0NmbkJvdCwgQ2ZuQm90QWxpYXMsIENmbkJvdFZlcnNpb259IGZyb20gXCJAYXdzLWNkay9hd3MtbGV4XCI7XG5cbmxldCBpZDogc3RyaW5nO1xuXG4vKipcbiAqIFN0YWNrXG4gKi9cbmV4cG9ydCBjbGFzcyBTdGFjayBleHRlbmRzIEJhc2VTdGFjayB7XG5cbiAgc3RhdGljIHJlYWRvbmx5IExPQ0FMRV9JRCA9ICdlbl9VUyc7XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7Q29uc3RydWN0fSBzY29wZSAtIFNjb3BlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBpZCAtIElkZW50aWZpZXJcbiAgICogQHBhcmFtIHtTdGFja1Byb3BzfSBwcm9wcyAtIFN0YWNrIHByb3BlcnRpZXNcbiAgICovXG4gIGNvbnN0cnVjdG9yIChzY29wZTogQXBwLCBpZEluOiBzdHJpbmcsIHByb3BzOiBTdGFja1Byb3BzKSB7XG5cbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGlkID0gaWRJbjtcbiAgICBjb25zdCByZWdpb24gPSBTdGFjay5vZih0aGlzKS5yZWdpb247XG4gICAgY29uc3QgY29ubmVjdEZsb3dGaWxlID0gJ3Zhbml0eS1udW1iZXItZ2VuZXJhdG9yLWZsb3cnO1xuXG4gICAgLy8gKioqKioqKioqKioqXG4gICAgLy8gRHluYW1vIFRhYmxlXG4gICAgLy8gKioqKioqKioqKioqXG4gICAgdGhpcy5nZXRWYW5pdHlOdW1iZXJEeW5hbW9UYWJsZSgpO1xuXG4gICAgLy8gKioqXG4gICAgLy8gQm90XG4gICAgLy8gKioqXG4gICAgY29uc3QgYm90ID0gdGhpcy5nZXRCb3QoKTtcbiAgICBjb25zdCBib3RWZXJzaW9uID0gdGhpcy5nZXRCb3RWZXJzaW9uKGJvdCk7XG4gICAgY29uc3QgbGFtYmRhID0gdGhpcy5nZXRMYW1iZGFGdW5jdGlvbigpO1xuICAgIGNvbnN0IGJvdEFsaWFzID0gdGhpcy5nZXRCb3RBbGlhcyhsYW1iZGEsIGJvdCwgYm90VmVyc2lvbik7XG4gICAgY29uc3QgaW52b2tlTGFtYmRhUGVybWlzc2lvbjogUGVybWlzc2lvbiA9IHtcbiAgICAgIGFjdGlvbjogJ2xhbWJkYTpJbnZva2VGdW5jdGlvbicsXG4gICAgICBwcmluY2lwYWw6IG5ldyBTZXJ2aWNlUHJpbmNpcGFsKCdsZXguYW1hem9uYXdzLmNvbScpLFxuICAgICAgc291cmNlQXJuOiBib3RBbGlhcy5hdHRyQXJuXG4gICAgfTtcblxuICAgIGxhbWJkYS5hZGRQZXJtaXNzaW9uKCdpbnZva2UtbGFtYmRhLXBlcm1pc3Npb24nLCBpbnZva2VMYW1iZGFQZXJtaXNzaW9uKTtcblxuICAgIC8vICoqKioqKioqKlxuICAgIC8vIFMzIEJ1Y2tldFxuICAgIC8vICoqKioqKioqKlxuICAgIGNvbnN0IHMzQnVja2V0ID0gbmV3IEJ1Y2tldCh0aGlzLCBgJHtpZH0tYnVja2V0YCwge1xuICAgICAgYnVja2V0TmFtZTogYCR7aWR9LWJ1Y2tldGAsXG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZVxuICAgIH0pO1xuXG4gICAgLy8gKioqKioqKioqKioqKioqXG4gICAgLy8gQ3VzdG9tIFJlc291cmNlXG4gICAgLy8gKioqKioqKioqKioqKioqXG4gICAgdGhpcy5nZXRDdXN0b21SZXNvdXJjZShib3RBbGlhcywgYm90LCByZWdpb24sIHMzQnVja2V0LCBjb25uZWN0Rmxvd0ZpbGUpO1xuXG4gICAgLy8gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAvLyBMaW5rIHRvIGNvbm5lY3QgZmxvdyB0byBtYW51YWxseSBpbXBvcnQgdG8gQ29ubmVjdFxuICAgIC8vICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgY29uc3QgczNDb25uZWN0RmxvdyA9IGBodHRwczovLyR7cmVnaW9ufS5jb25zb2xlLmF3cy5hbWF6b24uY29tL3MzL29iamVjdC8ke3MzQnVja2V0LmJ1Y2tldE5hbWV9P3JlZ2lvbj0ke3JlZ2lvbn0mcHJlZml4PSR7Y29ubmVjdEZsb3dGaWxlfWBcblxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgYHVwZGF0ZWRDb25uZWN0Rmxvd0xvY2F0aW9uYCwge1xuICAgICAgZGVzY3JpcHRpb246IFwiVXBkYXRlZCBjb25uZWN0IGZsb3cgdGhhdCBjYW4gYmUgaW1wb3J0ZWQgbWFudWFsbHkgaW50byBjb25uZWN0XCIsXG4gICAgICB2YWx1ZTogczNDb25uZWN0Rmxvd1xuICAgIH0pXG4gIH1cblxuICBnZXRWYW5pdHlOdW1iZXJEeW5hbW9UYWJsZSgpIHtcbiAgICBuZXcgQ2ZuVGFibGUodGhpcywgYCR7aWR9LXRhYmxlYCwge1xuICAgICAgYXR0cmlidXRlRGVmaW5pdGlvbnM6IFt7XG4gICAgICAgIGF0dHJpYnV0ZU5hbWU6ICdwaG9uZU51bWJlcicsXG4gICAgICAgIGF0dHJpYnV0ZVR5cGU6ICdTJ1xuICAgICAgfV0sXG4gICAgICBrZXlTY2hlbWE6IFt7XG4gICAgICAgIGF0dHJpYnV0ZU5hbWU6ICdwaG9uZU51bWJlcicsXG4gICAgICAgIGtleVR5cGU6ICdIQVNIJ1xuICAgICAgfV0sXG4gICAgICBwcm92aXNpb25lZFRocm91Z2hwdXQ6IHtcbiAgICAgICAgcmVhZENhcGFjaXR5VW5pdHM6IDEsXG4gICAgICAgIHdyaXRlQ2FwYWNpdHlVbml0czogMVxuICAgICAgfSxcbiAgICAgIHRhYmxlTmFtZTogJ3Zhbml0eS1udW1iZXItZ2VuZXJhdG9yJ1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgTGV4IGJvdC5cbiAgICogQHJldHVybnMge2xleC5DZm5Cb3R9IEJvdFxuICAgKi9cbiAgZ2V0Qm90ICgpOiBsZXguQ2ZuQm90IHtcbiAgICBjb25zdCBib3RSb2xlID0gdGhpcy5nZXRCb3RSb2xlKCk7XG5cbiAgICBjb25zdCBib3QgPSBuZXcgbGV4LkNmbkJvdCh0aGlzLCBgJHtpZH0tYm90YCwge1xuICAgICAgYm90TG9jYWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgZGVzY3JpcHRpb246IGAke1N0YWNrLkxPQ0FMRV9JRH0gbG9jYWxlYCxcbiAgICAgICAgICBpbnRlbnRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU3VnZ2VzdHMgcG9zc2libGUgdmFuaXR5IHBob25lIG51bWJlcnMgZm9yIGNhbGxlcnMgcGhvbmUgbnVtYmVyLicsXG4gICAgICAgICAgICAgIGRpYWxvZ0NvZGVIb29rOiB7XG4gICAgICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZVxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBmdWxmaWxsbWVudENvZGVIb29rOiB7XG4gICAgICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZVxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBuYW1lOiAnVmFuaXR5TnVtYmVyR2VuZXJhdG9yJyxcbiAgICAgICAgICAgICAgc2FtcGxlVXR0ZXJhbmNlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHV0dGVyYW5jZTogJ1llcydcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHNsb3RQcmlvcml0aWVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgcHJpb3JpdHk6IDEsXG4gICAgICAgICAgICAgICAgICBzbG90TmFtZTogJ3VzZUN1cnJlbnRQaG9uZU51bWJlcidcbiAgICAgICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgICBwcmlvcml0eTogMixcbiAgICAgICAgICAgICAgICAgIHNsb3ROYW1lOiAncGhvbmVOdW1iZXInXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICBzbG90czogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQ29uZmlybSB0aGF0IGN1cnJlbnQgcGhvbmUgbnVtYmVyIHNob3VsZCBiZSB1c2VkIHdoZW4gZ2VuZXJhdGluZyB2YW5pdHkgbnVtYmVyLicsXG4gICAgICAgICAgICAgICAgICBuYW1lOiAndXNlQ3VycmVudFBob25lTnVtYmVyJyxcbiAgICAgICAgICAgICAgICAgIHNsb3RUeXBlTmFtZTogJ0FNQVpPTi5BbHBoYU51bWVyaWMnLFxuICAgICAgICAgICAgICAgICAgdmFsdWVFbGljaXRhdGlvblNldHRpbmc6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJvbXB0U3BlY2lmaWNhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAgIGFsbG93SW50ZXJydXB0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICBtYXhSZXRyaWVzOiAxLFxuICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2VHcm91cHNMaXN0OiBbXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbGFpblRleHRNZXNzYWdlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogJ0RvIHlvdSB3YW50IHRvIGdldCB2YW5pdHkgbnVtYmVyIHN1Z2dlc3Rpb25zIGZvciB0aGUgcGhvbmUgbnVtYmVyIHlvdSBhcmUgY3VycmVudGx5IHVzaW5nPydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHNsb3RDb25zdHJhaW50OiAnUmVxdWlyZWQnXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FsdGVybmF0aXZlIHBob25lIG51bWJlciBwcm92aWRlZCBieSBjYWxsZXIuJyxcbiAgICAgICAgICAgICAgICAgIG5hbWU6ICdwaG9uZU51bWJlcicsXG4gICAgICAgICAgICAgICAgICBzbG90VHlwZU5hbWU6ICdBTUFaT04uUGhvbmVOdW1iZXInLFxuICAgICAgICAgICAgICAgICAgdmFsdWVFbGljaXRhdGlvblNldHRpbmc6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJvbXB0U3BlY2lmaWNhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAgIGFsbG93SW50ZXJydXB0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICBtYXhSZXRyaWVzOiAxLFxuICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2VHcm91cHNMaXN0OiBbXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbGFpblRleHRNZXNzYWdlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogJ1BsZWFzZSBlbnRlciBhIHZhbGlkIHBob25lIG51bWJlcj8nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBzbG90Q29uc3RyYWludDogJ1JlcXVpcmVkJ1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdEZWZhdWx0IGludGVudCB3aGVuIG5vIG90aGVyIGludGVudCBtYXRjaGVzJyxcbiAgICAgICAgICAgICAgaW50ZW50Q2xvc2luZ1NldHRpbmc6IHtcbiAgICAgICAgICAgICAgICBjbG9zaW5nUmVzcG9uc2U6IHtcbiAgICAgICAgICAgICAgICAgIG1lc3NhZ2VHcm91cHNMaXN0OiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFpblRleHRNZXNzYWdlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiBgU29ycnksIEkgY2FuJ3QgaGFuZGxlIGFsdGVybmF0aXZlIG51bWJlcnMgcmlnaHQgbm93LiBQbGVhc2UgdHJ5IGFnYWluIGxhdGVyLmBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGlzQWN0aXZlOiB0cnVlXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIG5hbWU6ICdGYWxsYmFja0ludGVudCcsXG4gICAgICAgICAgICAgIHBhcmVudEludGVudFNpZ25hdHVyZTogJ0FNQVpPTi5GYWxsYmFja0ludGVudCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdLFxuICAgICAgICAgIGxvY2FsZUlkOiBTdGFjay5MT0NBTEVfSUQsXG4gICAgICAgICAgbmx1Q29uZmlkZW5jZVRocmVzaG9sZDogMC40LFxuICAgICAgICAgIHZvaWNlU2V0dGluZ3M6IHtcbiAgICAgICAgICAgIHZvaWNlSWQ6ICdKb2FubmEnXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgZGF0YVByaXZhY3k6IHtcbiAgICAgICAgQ2hpbGREaXJlY3RlZDogdHJ1ZVxuICAgICAgfSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGV4IENoYXRib3QgdGhhdCBzdWdnZXN0cyBwb3NzaWJsZSB2YW5pdHkgcGhvbmUgbnVtYmVycyBmb3IgZ2l2ZW4gcGhvbmUgbnVtYmVyLicsXG4gICAgICBpZGxlU2Vzc2lvblR0bEluU2Vjb25kczogMzAwLFxuICAgICAgbmFtZTogYCR7aWR9LWJvdGAsXG4gICAgICByb2xlQXJuOiBib3RSb2xlLnJvbGVBcm5cbiAgICB9KTtcblxuICAgIHJldHVybiBib3Q7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBJQU0gcm9sZSB1c2VkIGJ5IExleCBib3QuXG4gICAqIEByZXR1cm5zIHtSb2xlfSBJQU0gcm9sZSBmb3IgTGV4IGJvdFxuICAgKi9cbiAgZ2V0Qm90Um9sZSAoKTogUm9sZSB7XG4gICAgY29uc3Qgcm9sZSA9IG5ldyBSb2xlKHRoaXMsIGAke2lkfS1ib3Qtcm9sZWAsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IFNlcnZpY2VQcmluY2lwYWwoJ2xleC5hbWF6b25hd3MuY29tJylcbiAgICB9KTtcblxuICAgIGNvbnN0IHBvbGljeSA9IG5ldyBQb2xpY3kodGhpcywgYCR7aWR9LXBvbGljeS1sb2ctYm90YCwge1xuICAgICAgcG9saWN5TmFtZTogJ0xvZ3MnLFxuICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAnbG9nczpDcmVhdGVMb2dHcm91cCcsXG4gICAgICAgICAgICAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLFxuICAgICAgICAgICAgJ2xvZ3M6UHV0TG9nRXZlbnRzJ1xuICAgICAgICAgIF0sXG4gICAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgICAgcmVzb3VyY2VzOiBbJ2Fybjphd3M6bG9nczoqOio6KiddXG4gICAgICAgIH0pXG4gICAgICBdXG4gICAgfSk7XG5cbiAgICByb2xlLmF0dGFjaElubGluZVBvbGljeShwb2xpY3kpO1xuXG4gICAgcmV0dXJuIHJvbGU7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBib3QgdmVyc2lvblxuICAgKiBAcGFyYW0gYm90XG4gICAqL1xuICBnZXRCb3RWZXJzaW9uKGJvdDogQ2ZuQm90KTogQ2ZuQm90VmVyc2lvbiB7XG4gICAgcmV0dXJuIG5ldyBsZXguQ2ZuQm90VmVyc2lvbih0aGlzLCBgJHtpZH0tdmVyc2lvbi0ke3RoaXMuZ2V0UmFuZG9tKCl9YCwge1xuICAgICAgYm90SWQ6IGJvdC5hdHRySWQsXG4gICAgICBib3RWZXJzaW9uTG9jYWxlU3BlY2lmaWNhdGlvbjogW1xuICAgICAgICB7XG4gICAgICAgICAgYm90VmVyc2lvbkxvY2FsZURldGFpbHM6IHtcbiAgICAgICAgICAgIHNvdXJjZUJvdFZlcnNpb246ICdEUkFGVCdcbiAgICAgICAgICB9LFxuICAgICAgICAgIGxvY2FsZUlkOiBTdGFjay5MT0NBTEVfSURcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVmFuaXR5IE51bWJlciBHZW5lcmF0b3IgQm90IFZlcnNpb24nXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBjb2RlIGhvb2sgTGFtYmRhIGZ1bmN0aW9uLlxuICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IExhbWJkYSBmdW5jdGlvblxuICAgKi9cbiAgZ2V0TGFtYmRhRnVuY3Rpb24gKCk6IEZ1bmN0aW9uIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvYmFuLXR5cGVzXG4gICAgY29uc3Qgcm9sZSA9IHRoaXMuZ2V0TGFtYmRhUm9sZSgpO1xuXG4gICAgcmV0dXJuIG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBgJHtpZH0tbGFtYmRhYCwge1xuICAgICAgYXdzU2RrQ29ubmVjdGlvblJldXNlOiB0cnVlLFxuICAgICAgZGVzY3JpcHRpb246ICdGdWxmaWxsbWVudCBMYW1iZGEgZm9yIFZhbml0eSBOdW1iZXIgR2VuZXJhdG9yIEJvdCcsXG4gICAgICBlbnRyeTogYHNyYy9tYWluL2xhbWJkYS9sYW1iZGEuanNgLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgIH0sXG4gICAgICBmdW5jdGlvbk5hbWU6IGAke2lkfS1sYW1iZGFgLFxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXInLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCwgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1tYWdpYy1udW1iZXJzXG4gICAgICByb2xlLFxuICAgICAgcnVudGltZTogUnVudGltZS5OT0RFSlNfMTRfWCxcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLnNlY29uZHMoMjApIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbWFnaWMtbnVtYmVyc1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgSUFNIHJvbGUgdXNlZCBieSBMYW1iZGEgY29kZSBob29rLlxuICAgKiBAcmV0dXJucyB7Um9sZX0gSUFNIHJvbGUgZm9yIExhbWJkYVxuICAgKi9cbiAgZ2V0TGFtYmRhUm9sZSAoKTogUm9sZSB7XG4gICAgY29uc3Qgcm9sZSA9IG5ldyBSb2xlKHRoaXMsIGAke2lkfS1sYW1iZGEtcm9sZWAsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IFNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJylcbiAgICB9KTtcblxuICAgIGNvbnN0IGxvZ1BvbGljeSA9IG5ldyBQb2xpY3kodGhpcywgYCR7aWR9LXBvbGljeS1sb2ctbGFtYmRhYCwge1xuICAgICAgcG9saWN5TmFtZTogJ0xvZ3MnLFxuICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAnbG9nczpDcmVhdGVMb2dHcm91cCcsXG4gICAgICAgICAgICAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLFxuICAgICAgICAgICAgJ2xvZ3M6UHV0TG9nRXZlbnRzJ1xuICAgICAgICAgIF0sXG4gICAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgICAgcmVzb3VyY2VzOiBbJ2Fybjphd3M6bG9nczoqOio6KiddXG4gICAgICAgIH0pXG4gICAgICBdXG4gICAgfSk7XG5cbiAgICByb2xlLmF0dGFjaElubGluZVBvbGljeShsb2dQb2xpY3kpO1xuXG4gICAgY29uc3QgZHluYW1vUG9saWN5ID0gbmV3IFBvbGljeSh0aGlzLCBgJHtpZH0tZHluYW1vLWxhbWJkYWAsIHtcbiAgICAgIHBvbGljeU5hbWU6ICdEeW5hbW8nLFxuICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAnZHluYW1vZGI6R2V0SXRlbScsXG4gICAgICAgICAgICAnZHluYW1vZGI6UHV0SXRlbScsXG4gICAgICAgICAgICAnZHluYW1vZGI6VXBkYXRlSXRlbSdcbiAgICAgICAgICBdLFxuICAgICAgICAgIGVmZmVjdDogRWZmZWN0LkFMTE9XLFxuICAgICAgICAgIHJlc291cmNlczogWydhcm46YXdzOmR5bmFtb2RiOio6Kjp0YWJsZS92YW5pdHktbnVtYmVyLWdlbmVyYXRvciddXG4gICAgICAgIH0pXG4gICAgICBdXG4gICAgfSk7XG5cbiAgICByb2xlLmF0dGFjaElubGluZVBvbGljeShkeW5hbW9Qb2xpY3kpO1xuXG4gICAgcmV0dXJuIHJvbGU7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBib3QgYWxpYXNcbiAgICogQHBhcmFtIGxhbWJkYVxuICAgKiBAcGFyYW0gYm90XG4gICAqIEBwYXJhbSBib3RWZXJzaW9uXG4gICAqL1xuICBnZXRCb3RBbGlhcyhsYW1iZGE6IEZ1bmN0aW9uLCBib3Q6IENmbkJvdCwgYm90VmVyc2lvbjogQ2ZuQm90VmVyc2lvbikge1xuICAgIHJldHVybiBuZXcgbGV4LkNmbkJvdEFsaWFzKHRoaXMsIGAke2lkfS1hbGlhc2AsIHtcbiAgICAgIGJvdEFsaWFzTG9jYWxlU2V0dGluZ3M6IFtcbiAgICAgICAge1xuICAgICAgICAgIGJvdEFsaWFzTG9jYWxlU2V0dGluZzoge1xuICAgICAgICAgICAgY29kZUhvb2tTcGVjaWZpY2F0aW9uOiB7XG4gICAgICAgICAgICAgIGxhbWJkYUNvZGVIb29rOiB7XG4gICAgICAgICAgICAgICAgY29kZUhvb2tJbnRlcmZhY2VWZXJzaW9uOiAnMS4wJyxcbiAgICAgICAgICAgICAgICBsYW1iZGFBcm46IGxhbWJkYS5mdW5jdGlvbkFyblxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZVxuICAgICAgICAgIH0sXG4gICAgICAgICAgbG9jYWxlSWQ6IFN0YWNrLkxPQ0FMRV9JRFxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgYm90QWxpYXNOYW1lOiBgJHtpZH0tYWxpYXNgLFxuICAgICAgYm90SWQ6IGJvdC5hdHRySWQsXG4gICAgICBib3RWZXJzaW9uOiBib3RWZXJzaW9uLmF0dHJCb3RWZXJzaW9uLFxuICAgICAgZGVzY3JpcHRpb246IGlkXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGN1c3RvbSByZXNvdXJjZSBsYW1iZGEgdG8gdXBkYXRlIGFuZCB1cGxvYWQgY29ubmVjdCBmbG93XG4gICAqIEBwYXJhbSBib3RBbGlhc1xuICAgKiBAcGFyYW0gYm90XG4gICAqIEBwYXJhbSByZWdpb25cbiAgICogQHBhcmFtIHMzQnVja2V0XG4gICAqIEBwYXJhbSBjb25uZWN0Rmxvd0ZpbGVcbiAgICovXG4gIGdldEN1c3RvbVJlc291cmNlKGJvdEFsaWFzOiBDZm5Cb3RBbGlhcywgYm90OiBDZm5Cb3QsIHJlZ2lvbjogc3RyaW5nLCBzM0J1Y2tldDogQnVja2V0LCBjb25uZWN0Rmxvd0ZpbGU6IHN0cmluZykge1xuICAgIGNvbnN0IGN1c3RvbVByb3ZpZGVyRnVuY3Rpb24gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgYCR7aWR9LWNyZWF0ZS1jb25uZWN0LWZsb3dgLCB7XG4gICAgICBkZXNjcmlwdGlvbjogJ0NyZWF0ZSBjb25uZWN0IGZsb3cnLFxuICAgICAgZW50cnk6IGBzcmMvbWFpbi9jb25uZWN0Rmxvdy9jcmVhdGVDb25uZWN0Rmxvdy5qc2AsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBib3RBbGlhc0FybjogYm90QWxpYXMuYXR0ckFybixcbiAgICAgICAgYm90TmFtZTogYm90Lm5hbWUsXG4gICAgICAgIHJlZ2lvbjogcmVnaW9uLFxuICAgICAgICByYW5kb21UYWc6IHRoaXMuZ2V0UmFuZG9tKCksXG4gICAgICAgIHMzQnVja2V0TmFtZTogczNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgZmxvd05hbWU6IGNvbm5lY3RGbG93RmlsZVxuICAgICAgfSxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7aWR9LWNvbm5lY3QtZmxvdy1jdXN0b20tcmVzb3VyY2VgLFxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXInLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCwgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1tYWdpYy1udW1iZXJzXG4gICAgICByb2xlOiB0aGlzLmdldEN1c3RvbVJlc291cmNlTGFtYmRhUm9sZSgpLFxuICAgICAgcnVudGltZTogUnVudGltZS5OT0RFSlNfMTRfWCxcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLnNlY29uZHMoMjApIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbWFnaWMtbnVtYmVyc1xuICAgIH0pO1xuICAgIHMzQnVja2V0LmdyYW50UmVhZFdyaXRlKGN1c3RvbVByb3ZpZGVyRnVuY3Rpb24pO1xuXG4gICAgY29uc3QgcHJvdmlkZXIgPSBuZXcgUHJvdmlkZXIodGhpcywgJ1Jlc291cmNlUHJvdmlkZXInLCB7XG4gICAgICBvbkV2ZW50SGFuZGxlcjogY3VzdG9tUHJvdmlkZXJGdW5jdGlvblxuICAgIH0pO1xuXG4gICAgbmV3IEN1c3RvbVJlc291cmNlKHRoaXMsICdwcm92aWRlckN1c3RvbVJlc291cmNlJywge1xuICAgICAgc2VydmljZVRva2VuOiBwcm92aWRlci5zZXJ2aWNlVG9rZW4sXG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIHJhbmRvbVRhZzogdGhpcy5nZXRSYW5kb20oKVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgSUFNIHJvbGUgdXNlZCBieSBDdXN0b20gUmVzb3VyY2UgTGFtYmRhIGNvZGUgaG9vay5cbiAgICogQHJldHVybnMge1JvbGV9IElBTSByb2xlIGZvciBMYW1iZGFcbiAgICovXG4gIGdldEN1c3RvbVJlc291cmNlTGFtYmRhUm9sZSAoKTogUm9sZSB7XG4gICAgY29uc3Qgcm9sZSA9IG5ldyBSb2xlKHRoaXMsIGAke2lkfS1jdXN0b20tcmVzb3VyY2UtbGFtYmRhLXJvbGVgLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBTZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpXG4gICAgfSk7XG5cbiAgICBjb25zdCBsb2dQb2xpY3kgPSBuZXcgUG9saWN5KHRoaXMsIGAke2lkfS1sb2ctcG9saWN5LWN1c3RvbS1yZXNvdXJjZS1sYW1iZGFgLCB7XG4gICAgICBwb2xpY3lOYW1lOiAnTG9ncycsXG4gICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICdsb2dzOkNyZWF0ZUxvZ0dyb3VwJyxcbiAgICAgICAgICAgICdsb2dzOkNyZWF0ZUxvZ1N0cmVhbScsXG4gICAgICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnXG4gICAgICAgICAgXSxcbiAgICAgICAgICBlZmZlY3Q6IEVmZmVjdC5BTExPVyxcbiAgICAgICAgICByZXNvdXJjZXM6IFsnYXJuOmF3czpsb2dzOio6KjoqJ11cbiAgICAgICAgfSlcbiAgICAgIF1cbiAgICB9KTtcblxuICAgIHJvbGUuYXR0YWNoSW5saW5lUG9saWN5KGxvZ1BvbGljeSk7XG5cbiAgICBjb25zdCBjb25uZWN0UG9saWN5ID0gbmV3IFBvbGljeSh0aGlzLCBgJHtpZH0tY29ubmVjdC0tY3VzdG9tLXJlc291cmNlLWxhbWJkYWAsIHtcbiAgICAgIHBvbGljeU5hbWU6ICdDb25uZWN0JyxcbiAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgYWN0aW9uczogW1wiaWFtOlB1dFJvbGVQb2xpY3lcIl0sXG4gICAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgICAgcmVzb3VyY2VzOiBbXCJhcm46YXdzOmlhbTo6Kjpyb2xlL2F3cy1zZXJ2aWNlLXJvbGUvY29ubmVjdC5hbWF6b25hd3MuY29tL0FXU1NlcnZpY2VSb2xlRm9yQW1hem9uQ29ubmVjdCpcIl1cbiAgICAgICAgfSlcbiAgICAgIF1cbiAgICB9KTtcblxuICAgIHJvbGUuYXR0YWNoSW5saW5lUG9saWN5KGNvbm5lY3RQb2xpY3kpO1xuXG4gICAgcm9sZS5hZGRNYW5hZ2VkUG9saWN5KE1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBbWF6b25Db25uZWN0X0Z1bGxBY2Nlc3MnKSlcblxuICAgIHJldHVybiByb2xlO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgcmFuZG9tIHN0cmluZy5cbiAgICogQHJldHVybnMge1N0cmluZ30gUmFuZG9tIGlkZW50aWZpZXJcbiAgICovXG4gIGdldFJhbmRvbSA9ICgpIDogc3RyaW5nID0+IE1hdGgucmFuZG9tKClcbiAgICAudG9TdHJpbmcoMzYpIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbWFnaWMtbnVtYmVyc1xuICAgIC5yZXBsYWNlKC9bXmEtel0rL2csICcnKVxuICAgIC5zdWJzdHJpbmcoMCwgNSk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbWFnaWMtbnVtYmVyc1xuXG59XG4iXX0=