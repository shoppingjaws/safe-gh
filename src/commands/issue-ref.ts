import type { ErrorResponse } from "../types.ts";

export interface IssueRef {
  repo: string;
  number: number;
}

export function parseIssueRef(ref: string, defaultRepo: string): IssueRef {
  // "123" → same repo
  const simpleNumber = /^\d+$/;
  if (simpleNumber.test(ref)) {
    const num = parseInt(ref, 10);
    if (isNaN(num) || num <= 0) {
      throw {
        error: `Invalid issue reference: '${ref}'. Expected a positive integer or owner/repo#123 format.`,
        code: "VALIDATION_ERROR",
      } satisfies ErrorResponse;
    }
    return { repo: defaultRepo, number: num };
  }

  // "owner/repo#123" → cross-repo
  const crossRepo = /^([^/]+\/[^#]+)#(\d+)$/;
  const match = ref.match(crossRepo);
  if (match) {
    const num = parseInt(match[2]!, 10);
    if (isNaN(num) || num <= 0) {
      throw {
        error: `Invalid issue reference: '${ref}'. Issue number must be a positive integer.`,
        code: "VALIDATION_ERROR",
      } satisfies ErrorResponse;
    }
    return { repo: match[1]!, number: num };
  }

  throw {
    error: `Invalid issue reference: '${ref}'. Expected a number (e.g. 123) or owner/repo#123 format.`,
    code: "VALIDATION_ERROR",
  } satisfies ErrorResponse;
}
