import { Command } from "commander";
import {
  validateConfig,
  initConfig,
  getConfigPath,
  loadConfig,
} from "../config.ts";
import { outputJson, handleError } from "./utils.ts";

export function createConfigCommand(): Command {
  const config = new Command("config").description("Configuration management");

  config
    .command("validate")
    .description("Validate the configuration file")
    .option("--path <path>", "Path to config file")
    .action((options) => {
      try {
        const result = validateConfig(options.path);
        if (result.valid) {
          outputJson({
            valid: true,
            path: options.path ?? getConfigPath(),
          });
        } else {
          outputJson({
            valid: false,
            errors: result.errors,
            path: options.path ?? getConfigPath(),
          });
          process.exit(1);
        }
      } catch (error) {
        handleError(error);
      }
    });

  config
    .command("init")
    .description("Create a template configuration file")
    .action(() => {
      try {
        const path = initConfig();
        outputJson({
          success: true,
          path,
          message: "Configuration template created. Edit it to add your rules.",
        });
      } catch (error) {
        handleError(error);
      }
    });

  config
    .command("path")
    .description("Show the configuration file path")
    .action(() => {
      outputJson({ path: getConfigPath() });
    });

  config
    .command("show")
    .description("Show the current configuration")
    .action(() => {
      try {
        const configData = loadConfig();
        outputJson({
          path: getConfigPath(),
          config: configData,
        });
      } catch (error) {
        handleError(error);
      }
    });

  return config;
}
