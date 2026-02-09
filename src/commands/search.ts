import { Command } from "commander";
import {
  searchCode,
  searchIssues,
  searchPrs,
  searchRepos,
  searchCommits,
} from "../gh-client.ts";
import { handleError } from "./utils.ts";

export function createSearchCommand(): Command {
  const search = new Command("search").description("Search operations");

  search
    .command("code")
    .description("Search code")
    .argument("<query>", "Search query")
    .option("-R, --repo <repo>", "Scope search to a repository")
    .action(async (query: string, options) => {
      try {
        const result = await searchCode(query, options.repo);
        console.log(result.trim());
      } catch (error) {
        handleError(error);
      }
    });

  search
    .command("issues")
    .description("Search issues")
    .argument("<query>", "Search query")
    .option("-R, --repo <repo>", "Scope search to a repository")
    .action(async (query: string, options) => {
      try {
        const result = await searchIssues(query, options.repo);
        console.log(result.trim());
      } catch (error) {
        handleError(error);
      }
    });

  search
    .command("prs")
    .description("Search pull requests")
    .argument("<query>", "Search query")
    .option("-R, --repo <repo>", "Scope search to a repository")
    .action(async (query: string, options) => {
      try {
        const result = await searchPrs(query, options.repo);
        console.log(result.trim());
      } catch (error) {
        handleError(error);
      }
    });

  search
    .command("repos")
    .description("Search repositories")
    .argument("<query>", "Search query")
    .action(async (query: string) => {
      try {
        const result = await searchRepos(query);
        console.log(result.trim());
      } catch (error) {
        handleError(error);
      }
    });

  search
    .command("commits")
    .description("Search commits")
    .argument("<query>", "Search query")
    .option("-R, --repo <repo>", "Scope search to a repository")
    .action(async (query: string, options) => {
      try {
        const result = await searchCommits(query, options.repo);
        console.log(result.trim());
      } catch (error) {
        handleError(error);
      }
    });

  return search;
}
