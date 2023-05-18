import * as util from 'util';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
const exec = util.promisify(cp.exec)
import * as core from '@actions/core';
import * as walk from "@root/walk";
import { chunk } from 'lodash';

export interface TerraformPlanInfo {
    dir_name: string
    error: boolean
    change: boolean
    command_output: string[]
}

class TerraformPlanExecution {
    constructor(public execution: () => Promise<any>) { }
}

export async function recursivePlan(root_dir: string): Promise<TerraformPlanInfo[]> {
    var data: TerraformPlanInfo[] = [];
    var executions: TerraformPlanExecution[] = [];
    const filterDirs = (entities: fs.Dirent[]) => {
        return entities
            .filter((ent) => ent.isDirectory() && !ent.name.includes(".terraform"));
    };

    const walkFunc = async (err, pathname: string, dirent: fs.Dirent) => {
        if (!fs.existsSync(path.join(pathname, "backend.tf"))) {
            return
        }
        const execution = new TerraformPlanExecution(
            async () => {
                const root = pathname;
                core.info(`In: ${root}`)
                var payload: TerraformPlanInfo = {
                    dir_name: root.substring(root_dir.length).length > 0 ? root.substring(root_dir.length) : path.basename(root_dir),
                    error: false,
                    change: false,
                    command_output: [],
                }
                try {
                    await terraformInit(root)
                } catch (e) {
                    payload.error = true
                    data.push(payload)
                    return
                }
                core.info(`Terraform init done for ${root}`)

                try {
                    const out = await terraformPlan(root)
                    core.info(`Terraform plan done for ${root}`)
                    payload.command_output = out.split(/(\n|%0A)/).filter((v) => v.length > 0 && v !== "\n" && v !== "%0A")
                } catch (error) {
                    if (error.code === 1) {
                        core.info(`Plan errored for ${root}`)
                        payload.error = true
                    } else if (error.code === 2) {
                        core.info(`Plan changed for ${root}`)
                        payload.change = true
                    }
                    payload.command_output = `Stdout: ${error.stdout}\nStderr: ${error.stderr}\n`.split(/(\n|%0A)/).filter((v) => v.length > 0 && v !== "\n" && v !== "%0A")
                }
                console.log(payload);

                try {
                    await terraformCleanup(root)
                } catch (error) {
                    core.error("Unable to cleanup .terraform")
                    throw error
                }

                data.push(payload)
            }
        )
        executions.push(execution);
    };

    const w = walk.create({ sort: filterDirs })
    console.log(`Start walk in ${root_dir}`)
    await w(root_dir, walkFunc);

    const batch_size = 10;
    const batches = chunk(executions, batch_size);
    for (const batch of batches) {
        const proms = [];
        for (const e of batch) {
            proms.push(e.execution())
        }
        await Promise.allSettled(proms);
    }

    return data
}

async function terraformInit(dir_path: string) {
    try {
        const { stdout, stderr } = await exec(`terraform -chdir=${dir_path} init -no-color`)
        core.info(stdout)
    } catch (error) {
        core.error(error.stdout)
        core.error(error.stderr)
        throw error
    }
}

async function terraformPlan(dir_path: string): Promise<string> {
    try {
        const { stdout, stderr } = await exec(`terraform -chdir=${dir_path} plan -no-color -detailed-exitcode`)
        core.info(stdout);
        core.info(stderr);
        return stdout
    } catch (error) {
        core.error(error.stdout)
        core.error(error.stderr)
        throw error
    }
}

export async function checkTerraformExists() {
    try {
        await exec("terraform -v")
    } catch {
        return false
    }
    return true
}

export async function terraformCleanup(dir_path: string) {
    try {
        const { stdout, stderr } = await exec(`cd ${dir_path} && rm -r .terraform`)
    } catch (error) {
        core.error(error.stdout)
        core.error(error.stderr)
        throw error
    }
}