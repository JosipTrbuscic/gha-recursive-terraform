import * as core from '@actions/core';
import { checkTerraformExists, recursivePlan } from './lib/terraform';
import { generateReport } from './lib/report';

const env_vars = [
  "INPUT_START_DIR",
  "INPUT_ENVIRONMENT",
]

for (const name of env_vars) {
  if (process.env[name] === undefined) {
    core.setFailed(`${name} is undefined`)
    throw new Error("")
  }
}

try {
  core.info("Checking if terraform command exists")
  const terraformExists = await checkTerraformExists()
  if (terraformExists) {
    core.info("Terraform command found")
  } else {
    throw Error("Terraform command NOT found")
  }

  console.log("Running recursive plan")
  const data = await recursivePlan(process.env.INPUT_START_DIR)
  await generateReport(data);
} catch (error) {
  core.setFailed(error.message);
}