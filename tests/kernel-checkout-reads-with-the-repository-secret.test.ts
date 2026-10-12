import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { parse } from "yaml";

// The device journey checks the kernel out of this forge's septagon-oss/platformkit
// at the commit the fixtures name. On this forge a job token reads the repository it
// was issued for and no other — kernel-main.yml says so where it reads the same
// repository, and the anonymous git read answers 401 — so a checkout of the kernel
// that carries no token of its own is a step no run gets past. The step reads with
// the same repository secret kernel-main reads with, and does not leave it in the
// checkout's own configuration afterwards.

const checkout = path.join(import.meta.dirname, "..");
const workflow = (at: string): { jobs: Record<string, { steps?: Record<string, unknown>[] }> } =>
  parse(readFileSync(path.join(checkout, at), "utf8")) as {
    jobs: Record<string, { steps?: Record<string, unknown>[] }>;
  };

test("the kernel checkout authorises with the secret kernel-main reads the kernel with", () => {
  const steps = workflow(".gitea/workflows/mobile-e2e.yml").jobs.journey!.steps ?? [];
  const kernel = steps.filter(
    (step) =>
      typeof step.uses === "string" &&
      step.uses.startsWith("actions/checkout@") &&
      (step.with as Record<string, unknown> | undefined)?.repository === "septagon-oss/platformkit",
  );
  assert.equal(kernel.length, 1, "one step checks the kernel out of the forge");
  const inputs = kernel[0]!.with as Record<string, unknown>;

  // The job token is nobody on another repository, so the read names a token of its own.
  const token = typeof inputs.token === "string" ? inputs.token : "";
  assert.match(
    token,
    /secrets\.PK_KERNEL_TOKEN/,
    `the kernel checkout reads with the repository secret kernel-main reads with; its inputs are ${JSON.stringify(inputs)}`,
  );

  // A token that stays in kernel-src/.git/config outlives the step that needed it.
  assert.equal(inputs["persist-credentials"], false);
});
