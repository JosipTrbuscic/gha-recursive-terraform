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

type TerraformPlanExecution = () => Promise<any>
type Outputs = { stdout: string, stderr: string }

export async function recursivePlan(root_dir: string, batch_size: number): Promise<TerraformPlanInfo[]> {
    var data: TerraformPlanInfo[] = [];
    var executions: TerraformPlanExecution[] = [];
    const filterDirs = (entities: fs.Dirent[]) => {
        return entities
            .filter((ent) =>
                ent.isDirectory() && !ent.name.includes(".terraform")
            );
    };

    const walkFunc = async (err, pathname: string, dirent: fs.Dirent) => {
        if (!fs.existsSync(path.join(pathname, "backend.tf"))) {
            return
        }
        const execution = async () => {
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
                const { stdout, stderr } = await terraformPlan(root)
                core.info(`Terraform plan done for ${root}`)
                payload.command_output = stdout.split(/(\n|%0A)/).filter((v) => v.length > 0 && v !== "\n" && v !== "%0A")
            } catch (error) {
                if (error.code === 1) {
                    core.info(`Plan errored for ${root}`)
                    core.error(error.stderr)
                    payload.error = true
                } else if (error.code === 2) {
                    core.info(`Plan changed for ${root}`)
                    payload.change = true
                }
                payload.command_output = `Stdout: ${error.stdout}\nStderr: ${error.stderr}\n`.split(/(\n|%0A)/).filter((v) => v.length > 0 && v !== "\n" && v !== "%0A")
            }

            try {
                await terraformCleanup(root)
            } catch (error) {
                core.error("Unable to cleanup .terraform")
                throw error
            }

            data.push(payload)
        }
        executions.push(execution);
    };

    const w = walk.create({ sort: filterDirs })
    core.info(`Start walk in ${root_dir}`)
    await w(root_dir, walkFunc);

    const batches = chunk(executions, batch_size);
    for (const batch of batches) {
        const proms = [];
        for (const e of batch) {
            proms.push(e())
        }
        await Promise.allSettled(proms);
    }

    return data
}

async function terraformInit(dir_path: string): Promise<Outputs> {
    return await exec(`terraform -chdir=${dir_path} init -no-color`)
}

async function terraformPlan(dir_path: string): Promise<Outputs> {
    return await exec(`terraform -chdir=${dir_path} plan -no-color -detailed-exitcode`)
}

export async function checkTerraformExists(): Promise<boolean> {
    try {
        await exec("terraform -v")
    } catch {
        return false
    }
    return true
}

export async function terraformCleanup(dir_path: string): Promise<Outputs> {
    return await exec(`cd ${dir_path} && rm -r .terraform`)
}