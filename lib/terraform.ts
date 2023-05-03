import * as util from 'util';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
const exec = util.promisify(cp.exec)
import * as core from '@actions/core';
import * as walk from "@root/walk";

export interface TerraformPlanInfo {
    dir_name: string
    error: boolean
    change: boolean
}

export async function recursivePlan(root_dir: string): Promise<TerraformPlanInfo[]> {
    var data: TerraformPlanInfo[] = []
    const filterDirs = (entities: fs.Dirent[]) => {
        return entities
            .filter((ent) => ent.isDirectory && !ent.name.includes(".terraform"));
    };

    const walkFunc = async (err, pathname: string, dirent: fs.Dirent) => {
        const root = pathname;
        if (!fs.existsSync(path.join(pathname, "backend.tf"))) {
            return
        }
        core.info(`In: ${root}`)
        var payload: TerraformPlanInfo = {
            dir_name: root.substring(root_dir.length),
            error: false,
            change: false,
        }
        try {
            await terraformInit(root)
        } catch (e) {
            payload.error = true
        }
        core.info(`Terraform init done for ${root}`)

        try {
            await terraformPlan(root)
            core.info(`Terraform plan done for ${root}`)
        } catch (error) {
            if (error.code === 1) {
                core.info(`Plan errored for ${root}`)
                payload.error = true
            } else if (error.code === 2) {
                core.info(`Plan changed for ${root}`)
                payload.change = true
            }
        }

        data.push(payload)
    };

    const w = walk.create({ sort: filterDirs })
    console.log(`Start walk in ${root_dir}`)
    await w(root_dir, walkFunc);

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

async function terraformPlan(dir_path: string) {
    try {
        const { stdout, stderr } = await exec(`terraform -chdir=${dir_path} plan -no-color -detailed-exitcode`)
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