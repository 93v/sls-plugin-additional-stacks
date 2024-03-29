import Serverless from "serverless";
import { setTimeout } from "timers/promises";

import PromisePool from "@supercharge/promise-pool";

import {
  AdditionalStack,
  IAdditionalStacksMap,
} from "../types/additional-stack";
import { Provider } from "../types/provider";
import { ServerlessOptions } from "../types/serverless-options";
import { ServerlessPluginCommand } from "../types/serverless-plugin-command";

const PARALLEL_LIMIT_SIZE = 3;

class ServerlessAdditionalStacksPlugin {
  public readonly commands: Record<string, ServerlessPluginCommand>;
  public readonly hooks: Record<string, () => Promise<any>>;
  public readonly provider: Provider;
  private readonly additionalStacksMap: IAdditionalStacksMap;
  private readonly log: (message: string) => void;

  public constructor(
    private readonly serverless: Serverless,
    private readonly options: ServerlessOptions,
    { log }: { log: (message: string) => void },
  ) {
    this.provider = this.serverless.getProvider("aws");
    this.log = log;

    this.additionalStacksMap =
      this.serverless.service?.custom?.additionalStacks || {};

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
    stack: AdditionalStack,
  ) => {
    try {
      const stackDescription = await this.describeStack(stackName, stack);

      const stackTags = {
        STAGE: this.options.stage || this.serverless.service.provider.stage,
        ...stack.Tags,
      };

      const cfTemplate = this.generateCloudFormationTemplate(stackName, stack);

      const params: Record<string, unknown> = {
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

      this.log(`Additional Stack "${stackName}" successfully created/updated!`);
    } catch (error) {
      if (
        (error as Error).message &&
        (error as Error).message.match(/ROLLBACK_COMPLETE/)
      ) {
        this.log(
          `IMPORTANT! Additional stack "${stackName}" ` +
            'is in "ROLLBACK_COMPLETE" state. The only way forward is ' +
            "to delete it as it has never finished creation.",
        );

        return;
      }
      if (
        (error as Error).message &&
        (error as Error).message.match(/^No updates/)
      ) {
        this.log(`Additional stack "${stackName}" has not changed.`);

        return;
      }
      throw error;
    }
  };

  private readonly deleteStack = async (
    stackName: string,
    stack: AdditionalStack,
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
      if (
        (error as Error).message &&
        (error as Error).message.match(/ROLLBACK_COMPLETE/)
      ) {
        this.log(
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
      this.log((error as Error).toString());

      return;
    }
  };

  private readonly deployStacks = async (stacks: IAdditionalStacksMap) => {
    this.log("Deploying additional stacks...");

    await PromisePool.for(Object.entries(stacks))
      .withConcurrency(PARALLEL_LIMIT_SIZE)
      .process(async ([stackName, stack]) =>
        this.createStack(stackName, stack),
      );
  };

  private readonly describeStack = async (
    stackName: string,
    stack: AdditionalStack,
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
      if (
        (error as Error).message &&
        (error as Error).message.match(/does not exist$/)
      ) {
        return null;
      }
      throw error;
    }
  };

  private readonly describeStacks = async (stacks: IAdditionalStacksMap) => {
    this.log("Describing additional stacks...");

    const { results } = await PromisePool.for(Object.entries(stacks))
      .withConcurrency(PARALLEL_LIMIT_SIZE)
      .process(async ([stackName, stack]) => ({
        ...(await this.describeStack(stackName, stack)),
        name: stackName,
      }));

    (await Promise.all(results)).forEach((stack) =>
      this.log(`  ${stack.name}: ${stack.StackStatus || "does not exist"}`),
    );
  };

  private readonly generateCloudFormationTemplate = (
    stackName: string,
    stack: AdditionalStack,
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
      this.log((error as Error).toString());

      return;
    }
  };

  private readonly getStackFullName = (
    stackName: string,
    stack: AdditionalStack,
  ) => stack.StackName || `${this.provider.naming.getStackName()}-${stackName}`;

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
      this.log((error as Error).toString());

      return;
    }
  };

  private readonly removeStacks = async (stacks: IAdditionalStacksMap) => {
    this.log("Removing additional stacks...");
    await PromisePool.for(Object.entries(stacks))
      .withConcurrency(PARALLEL_LIMIT_SIZE)
      .process(async ([stackName, stack]) =>
        this.deleteStack(stackName, stack),
      );
  };

  private readonly waitForStack = async (
    stackName: string,
    stack: AdditionalStack,
  ) => {
    let finished = false;

    while (!finished) {
      try {
        const stackDescription = await this.describeStack(stackName, stack);

        if (stackDescription == null) {
          this.log(`Additional stack "${stackName}" removed successfully.`);

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
          this.log(`Waiting for "${stackName}" status update...`);
          await setTimeout(3000);
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

        this.log(
          `Additional stack "${stackName}" (${stackDescription.StackStatus}).`,
        );
        finished = true;

        return;
      } catch (error) {
        if (
          (error as Error).message &&
          (error as Error).message.match(/^Rate exceeded/)
        ) {
          await setTimeout(3000);
          continue;
        }
        throw error;
      }
    }
  };
}

export = ServerlessAdditionalStacksPlugin;
