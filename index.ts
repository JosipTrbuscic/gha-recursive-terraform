import * as core from '@actions/core';
import { checkTerraformExists, recursivePlan } from './lib/terraform';
import { generateAsciiTable, generateReport } from './lib/report';
import { stat } from 'fs/promises';

const env_vars = [
  "INPUT_START_DIR",
  "INPUT_ENVIRONMENT",
  "INPUT_BATCH_SIZE",
]

async function validateEnvVars() {
  const batch_size_string = process.env[env_vars[2]];
  if (isNaN(parseInt(batch_size_string, 10))) {
    throw new Error("Batch size mush be a valid integer")
  }

  const start_dir = await stat(process.env[env_vars[0]]);
  if (!start_dir.isDirectory()) {
    throw new Error("Start dir must be a valid directory")
  }

}

for (const name of env_vars) {
  if (process.env[name] === undefined) {
    core.setFailed(`${name} is undefined`)
    throw new Error("Undefined required env variable")
  }
}

try {
  await validateEnvVars();
  core.info("Checking if terraform command exists")
  const terraformExists = await checkTerraformExists()
  if (terraformExists) {
    core.info("Terraform command found")
  } else {
    throw Error("Terraform command NOT found")
  }

  console.log("Running recursive plan")
  const data = await recursivePlan(process.env.INPUT_START_DIR, parseInt(process.env.INPUT_BATCH_SIZE))
  await generateReport(data);
  console.log(generateAsciiTable(data));
} catch (error) {
  core.setFailed(error.message);
}