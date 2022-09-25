"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stack_1 = require("../lib/stack");
const core_1 = require("@aws-cdk/core");
const app = new core_1.App();
/**
 * Initalise the stack
 */
new stack_1.Stack(app, "vanity-number-generator", {
    stackName: "vanity-number-generator",
    env: {
        region: process.env.CDK_DEFAULT_REGION,
        account: process.env.CDK_DEFAULT_ACCOUNT,
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3RhY2tJbml0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiU3RhY2tJbml0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsd0NBQXFDO0FBQ3JDLHdDQUFvQztBQUVwQyxNQUFNLEdBQUcsR0FBRyxJQUFJLFVBQUcsRUFBRSxDQUFDO0FBRXRCOztHQUVHO0FBQ0gsSUFBSSxhQUFLLENBQUMsR0FBRyxFQUFFLHlCQUF5QixFQUFFO0lBQ3hDLFNBQVMsRUFBRSx5QkFBeUI7SUFDcEMsR0FBRyxFQUFFO1FBQ0gsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCO1FBQ3RDLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtLQUN6QztDQUNGLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFN0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrJztcbmltcG9ydCB7IEFwcCB9IGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xuXG5jb25zdCBhcHAgPSBuZXcgQXBwKCk7XG5cbi8qKlxuICogSW5pdGFsaXNlIHRoZSBzdGFja1xuICovXG5uZXcgU3RhY2soYXBwLCBcInZhbml0eS1udW1iZXItZ2VuZXJhdG9yXCIsIHtcbiAgc3RhY2tOYW1lOiBcInZhbml0eS1udW1iZXItZ2VuZXJhdG9yXCIsXG4gIGVudjoge1xuICAgIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OLFxuICAgIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQsXG4gIH1cbn0pO1xuIl19