import { readFile, writeFile } from "fs/promises";
import * as Handlebars from "handlebars";
import { join } from "path";
import { TerraformPlanInfo } from "./terraform";
import * as asciitable from "ascii-table";

Handlebars.registerHelper("planResult", function (directory, options): string {
    if (directory.change) {
        return "change"
    } else if (directory.error) {
        return "error"
    } else {
        return "nochange"
    }
});

Handlebars.registerHelper("concatStdout", function (stdout: string[], options): string {
    return stdout.join("\n")
});

export async function generateReport(data: TerraformPlanInfo[]) {
    const templateFile = await readFile(join(__dirname, "./index.hbs"), { encoding: "utf-8" });
    const template = Handlebars.compile(templateFile);
    const env = process.env.INPUT_ENVIRONMENT
    const res = template({ environment: env, moduleInfo: data });


    console.log("Writing terraform_plan_index.html")
    await writeFile("terraform_plan_index.html", res, { encoding: "utf-8", flag: 'w' });
}

export function generateAsciiTable(data: TerraformPlanInfo[]): string {
    const table = new asciitable('Terraform plan report')

    table.setHeading('Directory', 'Result')
    for (const tp of data) {
        const text = tp.change ? 'Changed' : tp.error ? 'Error' : 'Ok';
        table.addRow(tp.dir_name, text)
    }

    return table.toString()
}