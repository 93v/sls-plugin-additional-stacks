import Serverless from "serverless";
import { oc } from "ts-optchain";
import {
  IAdditionalStack,
  IAdditionalStacksMap,
} from "../types/additional-stack";
import { IProvider } from "../types/provider";
import { IServerlessOptions } from "../types/serverless-options";
import { IServerlessPluginCommand } from "../types/serverless-plugin-command";

const asyncWait = async (delay: number) =>
  new Promise((res) => setTimeout(res, delay));

class ServerlessAdditionalStacksPlugin {
  public readonly commands: {
    [command: string]: IServerlessPluginCommand;
  };
  public readonly hooks: {
    [event: string]: () => Promise<any>;
  };
  public readonly provider: IProvider;
  private readonly additionalStacksMap: IAdditionalStacksMap;

  public constructor(
    private readonly serverless: Serverless,
    private readonly options: IServerlessOptions,
  ) {
    this.provider = this.serverless.getProvider("aws");

    this.additionalStacksMap = oc(
      this.serverless,
    ).service.custom.additionalStacks({});

    this.commands = {
      deploy: {
        commands: {
          additionalStacks: {
            lifecycleEvents: ["deploy"],
            options: { stack: { usage: "Additional Stack name to Deploy" } },
            usage: "Deploy Additional Stack",
          },
        },
        options: {
          skipAdditionalStacks: { usage: "Skip deploying Additional Stacks" },
        },
      },
      remove: {
        commands: {
          additionalStacks: {
            lifecycleEvents: ["remove"],
            options: {
              all: { usage: "Explicitly state the wish to remove all stacks" },
              stack: { usage: "Additional Stack name to Remove" },
            },
            usage: "Remove Additional Stack",
          },
        },
      },
    };

    this.hooks = {
      "after:info:info": this.getAdditionalStacksInfo,
      "before:deploy:deploy": this.deployAdditionalStacks,
      "deploy:additionalStacks:deploy": this.deployAdditionalStacks,
      "remove:additionalStacks:remove": this.removeAdditionalStacks,
    };
  }

  private readonly createStack = async (
    stackName: string,
    stack: IAdditionalStack,
  ) => {
    try {
      const stackDescription = await this.describeStack(stackName, stack);

      const stackTags = {
        STAGE: oc(this.options).stage(this.serverless.service.provider.stage),
        ...stack.Tags,
      };

      const cfTemplate = this.generateCloudFormationTemplate(stackName, stack);

      const params = {
        Capabilities: ["CAPABILITY_IAM", "CAPABILITY_NAMED_IAM"],
        OnFailure: "ROLLBACK",
        Parameters: [],
        StackName: this.getStackFullName(stackName, stack),
        Tags: Object.keys(stackTags).map((key: string) => ({
          Key: key,
          Value: stackTags[key],
        })),
        TemplateBody: JSON.stringify(cfTemplate),
      };

      if (stackDescription != null) {
        delete params.OnFailure;
      }

      await this.provider.request(
        "CloudFormation",
        `${stackDescription != null ? "update" : "create"}Stack`,
        params,
        this.options.stage,
        this.options.region,
      );

      await this.waitForStack(stackName, stack);

      this.serverless.cli.log(
        `Additional Stack "${stackName}" successfully created/updated!`,
      );
    } catch (error) {
      if (error.message && error.message.match(/ROLLBACK_COMPLETE/)) {
        this.serverless.cli.log(
          `IMPORTANT! Additional stack "${stackName}" ` +
            'is in "ROLLBACK_COMPLETE" state. The only way forward is ' +
            "to delete it as it has never finished creation.",
        );

        return;
      }
      if (error.message && error.message.match(/^No updates/)) {
        this.serverless.cli.log(
          `Additional stack "${stackName}" has not changed.`,
        );

        return;
      }
      throw error;
    }
  };

  private readonly deleteStack = async (
    stackName: string,
    stack: IAdditionalStack,
  ) => {
    try {
      const params = {
        StackName: this.getStackFullName(stackName, stack),
      };

      await this.provider.request(
        "CloudFormation",
        "deleteStack",
        params,
        this.options.stage,
        this.options.region,
      );

      await this.waitForStack(stackName, stack);
    } catch (error) {
      if (error.message && error.message.match(/ROLLBACK_COMPLETE/)) {
        this.serverless.cli.log(
          `IMPORTANT! Additional stack "${stackName}" ` +
            'is in "ROLLBACK_COMPLETE" state. The only way forward is ' +
            "to delete it as it has never finished creation.",
        );

        return;
      }
      throw error;
    }
  };

  private readonly deployAdditionalStacks = async () => {
    if (this.options.skipAdditionalStacks) {
      return;
    }
    try {
      return this.deployStacks(this.getStacks("deploy"));
    } catch (error) {
      this.serverless.cli.log(error);

      return;
    }
  };

  private readonly deployStacks = async (stacks: IAdditionalStacksMap) => {
    this.serverless.cli.log("Deploying additional stacks...");
    await Promise.all(
      Object.entries(stacks).map(([stackName, stack]) =>
        this.createStack(stackName, stack),
      ),
    );
  };

  private readonly describeStack = async (
    stackName: string,
    stack: IAdditionalStack,
  ) => {
    try {
      const response = await this.provider.request(
        "CloudFormation",
        "describeStacks",
        { StackName: this.getStackFullName(stackName, stack) },
        this.options.stage,
        this.options.region,
      );

      if (response.Stacks == null) {
        return null;
      }

      return response.Stacks[0];
    } catch (error) {
      if (error.message && error.message.match(/does not exist$/)) {
        return null;
      }
      throw error;
    }
  };

  private readonly describeStacks = async (stacks: IAdditionalStacksMap) => {
    this.serverless.cli.log("Describing additional stacks...");
    const additionalStacks = await Promise.all(
      Object.entries(stacks).map(async ([stackName, stack]) => ({
        ...(await this.describeStack(stackName, stack)),
        name: stackName,
      })),
    );
    additionalStacks.forEach((stack) =>
      this.serverless.cli.log(
        `  ${stack.name}: ${stack.StackStatus || "does not exist"}`,
      ),
    );
  };

  private readonly generateCloudFormationTemplate = (
    stackName: string,
    stack: IAdditionalStack,
  ) => ({
    AWSTemplateFormatVersion: "2010-09-09",
    Conditions: stack.Conditions || undefined,
    Description: stack.Description || `${stackName} additional stack`,
    Mappings: stack.Mappings || undefined,
    Metadata: stack.Metadata || undefined,
    Outputs: stack.Outputs || undefined,
    Parameters: stack.Parameters || undefined,
    Resources: stack.Resources || undefined,
    Transform: stack.Transform || undefined,
  });
  private readonly getAdditionalStacksInfo = async () => {
    try {
      return this.describeStacks(this.getStacks("describe"));
    } catch (error) {
      this.serverless.cli.log(error);

      return;
    }
  };

  private readonly getStackFullName = (
    stackName: string,
    stack: IAdditionalStack,
  ) =>
    oc(stack).StackName(`${this.provider.naming.getStackName()}-${stackName}`);

  private readonly getStacks = (
    purpose: "deploy" | "remove" | "describe" = "deploy",
  ) => {
    if (Object.keys(this.additionalStacksMap).length === 0) {
      throw new Error(
        "No Additional Stacks are defined. Add one to custom.additionalStacks section",
      );
    }

    const stacks = { ...this.additionalStacksMap };
    if (this.options.stack != null) {
      Object.keys(stacks).forEach((k) => {
        if (k !== this.options.stack) {
          delete stacks[k];
        }
      });
    }

    if (
      purpose === "remove" &&
      this.options.stack == null &&
      this.options.all == null
    ) {
      Object.keys(stacks).forEach((k) => {
        delete stacks[k];
      });
    }

    if (Object.keys(stacks).length === 0) {
      throw new Error(`Nothing to ${purpose}. Check your stack name`);
    }

    return stacks;
  };
  private readonly removeAdditionalStacks = async () => {
    try {
      return this.removeStacks(this.getStacks("remove"));
    } catch (error) {
      this.serverless.cli.log(error);

      return;
    }
  };

  private readonly removeStacks = async (stacks: IAdditionalStacksMap) => {
    this.serverless.cli.log("Removing additional stacks...");
    await Promise.all(
      Object.entries(stacks).map(([stackName, stack]) =>
        this.deleteStack(stackName, stack),
      ),
    );
  };

  private readonly waitForStack = async (
    stackName: string,
    stack: IAdditionalStack,
  ) => {
    let finished = false;

    while (!finished) {
      try {
        const stackDescription = await this.describeStack(stackName, stack);

        if (stackDescription == null) {
          this.serverless.cli.log(
            `Additional stack "${stackName}" removed successfully.`,
          );

          return;
        }

        if (
          [
            "CREATE_IN_PROGRESS",
            "DELETE_IN_PROGRESS",
            "REVIEW_IN_PROGRESS",
            "ROLLBACK_IN_PROGRESS",
            "UPDATE_COMPLETE_CLEANUP_IN_PROGRESS",
            "UPDATE_IN_PROGRESS",
            "UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS",
            "UPDATE_ROLLBACK_IN_PROGRESS",
          ].includes(stackDescription.StackStatus)
        ) {
          this.serverless.cli.log(
            `Waiting for "${stackName}" status update...`,
          );
          await asyncWait(3000);
          continue;
        }

        if (
          [
            "CREATE_FAILED",
            "DELETE_FAILED",
            "ROLLBACK_FAILED",
            "ROLLBACK_COMPLETE",
            "UPDATE_ROLLBACK_COMPLETE",
            "UPDATE_ROLLBACK_FAILED",
          ].includes(stackDescription.StackStatus)
        ) {
          throw new Error(
            `Additional stack "${stackName}" (${stackDescription.StackStatus})`,
          );
        }

        this.serverless.cli.log(
          `Additional stack "${stackName}" (${stackDescription.StackStatus}).`,
        );
        finished = true;

        return;
      } catch (error) {
        if (error.message && error.message.match(/^Rate exceeded/)) {
          await asyncWait(3000);
          continue;
        }
        throw error;
      }
    }
  };
}

export = ServerlessAdditionalStacksPlugin;
