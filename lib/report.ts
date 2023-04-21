import { readFile, writeFile } from "fs/promises";
import * as Handlebars from "handlebars";
import { join } from "path";
import { TerraformPlanInfo } from "./terraform";

Handlebars.registerHelper("planResult", function (directory, options): string {
    if (directory.change) {
        return "change"
    } else if (directory.error) {
        return "error"
    } else {
        return "nochange"
    }
});

export async function generateReport(data: TerraformPlanInfo[]) {
    const templateFile = await readFile(join(__dirname, "./index.hbs"), { encoding: "utf-8" });
    const template = Handlebars.compile(templateFile);
    const env = process.env.INPUT_ENVIRONMENT
    console.log
    const res = template({ environment: env, moduleInfo: data });


    console.log("Writing terraform_plan_index.html")
    await writeFile("terraform_plan_index.html", res, { encoding: "utf-8", flag: 'w' });
}