import { Command } from "commander";
import {
  listProjects,
  viewProject,
  projectFieldList,
  projectItemList,
  projectCreate,
  projectEdit,
  projectClose,
  projectDelete,
  projectItemAdd,
  projectItemCreate,
  projectItemEdit,
  projectItemDelete,
  projectItemArchive,
  projectFieldCreate,
  projectFieldDelete,
} from "../gh-client.ts";
import { outputJson, handleError } from "./utils.ts";

export function createProjectCommand(): Command {
  const project = new Command("project").description("Project operations");

  project
    .command("list")
    .description("List projects")
    .option("--owner <owner>", "Project owner (user or org)")
    .action(async (options) => {
      try {
        const result = await listProjects(options.owner);
        console.log(result.trim());
      } catch (error) {
        handleError(error);
      }
    });

  project
    .command("view")
    .description("View a project")
    .argument("<number>", "Project number")
    .option("--owner <owner>", "Project owner (user or org)")
    .action(async (number: string, options) => {
      try {
        const projectNumber = parseInt(number, 10);
        if (isNaN(projectNumber)) {
          throw { error: "Invalid project number", code: "VALIDATION_ERROR" };
        }
        const result = await viewProject(projectNumber, options.owner);
        console.log(result.trim());
      } catch (error) {
        handleError(error);
      }
    });

  project
    .command("field-list")
    .description("List fields in a project")
    .argument("<number>", "Project number")
    .option("--owner <owner>", "Project owner (user or org)")
    .action(async (number: string, options) => {
      try {
        const projectNumber = parseInt(number, 10);
        if (isNaN(projectNumber)) {
          throw { error: "Invalid project number", code: "VALIDATION_ERROR" };
        }
        const result = await projectFieldList(projectNumber, options.owner);
        console.log(result.trim());
      } catch (error) {
        handleError(error);
      }
    });

  project
    .command("item-list")
    .description("List items in a project")
    .argument("<number>", "Project number")
    .option("--owner <owner>", "Project owner (user or org)")
    .action(async (number: string, options) => {
      try {
        const projectNumber = parseInt(number, 10);
        if (isNaN(projectNumber)) {
          throw { error: "Invalid project number", code: "VALIDATION_ERROR" };
        }
        const result = await projectItemList(projectNumber, options.owner);
        console.log(result.trim());
      } catch (error) {
        handleError(error);
      }
    });

  project
    .command("create")
    .description("Create a new project")
    .requiredOption("-t, --title <title>", "Project title")
    .option("--owner <owner>", "Project owner (user or org)")
    .action(async (options) => {
      try {
        const result = await projectCreate(options.title, options.owner);
        console.log(result.trim());
      } catch (error) {
        handleError(error);
      }
    });

  project
    .command("edit")
    .description("Edit a project")
    .argument("<number>", "Project number")
    .option("--title <title>", "New title")
    .option("--description <desc>", "New description")
    .option("--visibility <visibility>", "Visibility: PUBLIC or PRIVATE")
    .option("--owner <owner>", "Project owner (user or org)")
    .action(async (number: string, options) => {
      try {
        const projectNumber = parseInt(number, 10);
        if (isNaN(projectNumber)) {
          throw { error: "Invalid project number", code: "VALIDATION_ERROR" };
        }
        await projectEdit(projectNumber, {
          title: options.title,
          description: options.description,
          visibility: options.visibility,
          owner: options.owner,
        });
        outputJson({ success: true, projectNumber, message: "Project edited successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  project
    .command("close")
    .description("Close a project")
    .argument("<number>", "Project number")
    .option("--owner <owner>", "Project owner (user or org)")
    .action(async (number: string, options) => {
      try {
        const projectNumber = parseInt(number, 10);
        if (isNaN(projectNumber)) {
          throw { error: "Invalid project number", code: "VALIDATION_ERROR" };
        }
        await projectClose(projectNumber, options.owner);
        outputJson({ success: true, projectNumber, message: "Project closed successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  project
    .command("delete")
    .description("Delete a project")
    .argument("<number>", "Project number")
    .option("--owner <owner>", "Project owner (user or org)")
    .action(async (number: string, options) => {
      try {
        const projectNumber = parseInt(number, 10);
        if (isNaN(projectNumber)) {
          throw { error: "Invalid project number", code: "VALIDATION_ERROR" };
        }
        await projectDelete(projectNumber, options.owner);
        outputJson({ success: true, projectNumber, message: "Project deleted successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  project
    .command("item-add")
    .description("Add an item to a project")
    .argument("<number>", "Project number")
    .requiredOption("--url <url>", "URL of the issue or PR to add")
    .option("--owner <owner>", "Project owner (user or org)")
    .action(async (number: string, options) => {
      try {
        const projectNumber = parseInt(number, 10);
        if (isNaN(projectNumber)) {
          throw { error: "Invalid project number", code: "VALIDATION_ERROR" };
        }
        const result = await projectItemAdd(projectNumber, options.url, options.owner);
        console.log(result.trim());
      } catch (error) {
        handleError(error);
      }
    });

  project
    .command("item-create")
    .description("Create a draft issue in a project")
    .argument("<number>", "Project number")
    .requiredOption("-t, --title <title>", "Item title")
    .option("-b, --body <body>", "Item body")
    .option("--owner <owner>", "Project owner (user or org)")
    .action(async (number: string, options) => {
      try {
        const projectNumber = parseInt(number, 10);
        if (isNaN(projectNumber)) {
          throw { error: "Invalid project number", code: "VALIDATION_ERROR" };
        }
        const result = await projectItemCreate(projectNumber, options.title, {
          body: options.body,
          owner: options.owner,
        });
        console.log(result.trim());
      } catch (error) {
        handleError(error);
      }
    });

  project
    .command("item-edit")
    .description("Edit a project item field value")
    .argument("<number>", "Project number")
    .requiredOption("--id <id>", "Item ID")
    .requiredOption("--field-id <fieldId>", "Field ID")
    .option("--text <text>", "Text value")
    .option("--number <number>", "Number value")
    .option("--date <date>", "Date value (YYYY-MM-DD)")
    .option("--single-select-option-id <optionId>", "Single select option ID")
    .option("--iteration-id <iterationId>", "Iteration ID")
    .option("--owner <owner>", "Project owner (user or org)")
    .action(async (number: string, options) => {
      try {
        const projectNumber = parseInt(number, 10);
        if (isNaN(projectNumber)) {
          throw { error: "Invalid project number", code: "VALIDATION_ERROR" };
        }
        await projectItemEdit(projectNumber, options.id, {
          fieldId: options.fieldId,
          text: options.text,
          number: options.number !== undefined ? parseFloat(options.number) : undefined,
          date: options.date,
          singleSelectOptionId: options.singleSelectOptionId,
          iterationId: options.iterationId,
          owner: options.owner,
        });
        outputJson({ success: true, projectNumber, itemId: options.id, message: "Item edited successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  project
    .command("item-delete")
    .description("Delete a project item")
    .argument("<number>", "Project number")
    .requiredOption("--id <id>", "Item ID")
    .option("--owner <owner>", "Project owner (user or org)")
    .action(async (number: string, options) => {
      try {
        const projectNumber = parseInt(number, 10);
        if (isNaN(projectNumber)) {
          throw { error: "Invalid project number", code: "VALIDATION_ERROR" };
        }
        await projectItemDelete(projectNumber, options.id, options.owner);
        outputJson({ success: true, projectNumber, itemId: options.id, message: "Item deleted successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  project
    .command("item-archive")
    .description("Archive a project item")
    .argument("<number>", "Project number")
    .requiredOption("--id <id>", "Item ID")
    .option("--owner <owner>", "Project owner (user or org)")
    .action(async (number: string, options) => {
      try {
        const projectNumber = parseInt(number, 10);
        if (isNaN(projectNumber)) {
          throw { error: "Invalid project number", code: "VALIDATION_ERROR" };
        }
        await projectItemArchive(projectNumber, options.id, options.owner);
        outputJson({ success: true, projectNumber, itemId: options.id, message: "Item archived successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  project
    .command("field-create")
    .description("Create a project field")
    .argument("<number>", "Project number")
    .requiredOption("--name <name>", "Field name")
    .requiredOption("--data-type <type>", "Field data type (TEXT, NUMBER, DATE, SINGLE_SELECT, ITERATION)")
    .option("--owner <owner>", "Project owner (user or org)")
    .action(async (number: string, options) => {
      try {
        const projectNumber = parseInt(number, 10);
        if (isNaN(projectNumber)) {
          throw { error: "Invalid project number", code: "VALIDATION_ERROR" };
        }
        const result = await projectFieldCreate(projectNumber, options.name, options.dataType, options.owner);
        console.log(result.trim());
      } catch (error) {
        handleError(error);
      }
    });

  project
    .command("field-delete")
    .description("Delete a project field")
    .argument("<number>", "Project number")
    .requiredOption("--id <id>", "Field ID")
    .option("--owner <owner>", "Project owner (user or org)")
    .action(async (number: string, options) => {
      try {
        const projectNumber = parseInt(number, 10);
        if (isNaN(projectNumber)) {
          throw { error: "Invalid project number", code: "VALIDATION_ERROR" };
        }
        await projectFieldDelete(projectNumber, options.id, options.owner);
        outputJson({ success: true, projectNumber, fieldId: options.id, message: "Field deleted successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  return project;
}
