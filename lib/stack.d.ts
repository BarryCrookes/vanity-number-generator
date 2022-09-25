import * as lex from '@aws-cdk/aws-lex';
import { App, Stack as BaseStack, StackProps } from '@aws-cdk/core';
import { Role } from '@aws-cdk/aws-iam';
import { Function } from '@aws-cdk/aws-lambda';
import { Bucket } from '@aws-cdk/aws-s3';
import { CfnBot, CfnBotAlias, CfnBotVersion } from "@aws-cdk/aws-lex";
/**
 * Stack
 */
export declare class Stack extends BaseStack {
    static readonly LOCALE_ID = "en_US";
    /**
     * Constructor
     * @param {Construct} scope - Scope
     * @param {String} id - Identifier
     * @param {StackProps} props - Stack properties
     */
    constructor(scope: App, idIn: string, props: StackProps);
    getVanityNumberDynamoTable(): void;
    /**
     * Returns Lex bot.
     * @returns {lex.CfnBot} Bot
     */
    getBot(): lex.CfnBot;
    /**
     * Returns IAM role used by Lex bot.
     * @returns {Role} IAM role for Lex bot
     */
    getBotRole(): Role;
    /**
     * Returns bot version
     * @param bot
     */
    getBotVersion(bot: CfnBot): CfnBotVersion;
    /**
     * Returns code hook Lambda function.
     * @returns {Function} Lambda function
     */
    getLambdaFunction(): Function;
    /**
     * Returns IAM role used by Lambda code hook.
     * @returns {Role} IAM role for Lambda
     */
    getLambdaRole(): Role;
    /**
     * Returns bot alias
     * @param lambda
     * @param bot
     * @param botVersion
     */
    getBotAlias(lambda: Function, bot: CfnBot, botVersion: CfnBotVersion): lex.CfnBotAlias;
    /**
     * Create custom resource lambda to update and upload connect flow
     * @param botAlias
     * @param bot
     * @param region
     * @param s3Bucket
     * @param connectFlowFile
     */
    getCustomResource(botAlias: CfnBotAlias, bot: CfnBot, region: string, s3Bucket: Bucket, connectFlowFile: string): void;
    /**
     * Returns IAM role used by Custom Resource Lambda code hook.
     * @returns {Role} IAM role for Lambda
     */
    getCustomResourceLambdaRole(): Role;
    /**
     * Returns random string.
     * @returns {String} Random identifier
     */
    getRandom: () => string;
}
