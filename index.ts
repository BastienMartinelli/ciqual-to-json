import { existsSync, mkdir, writeFile } from "fs";
import fetch from "node-fetch";
import { promisify } from "util";
import xlsx from "xlsx";
import { baseKeysMap, compoKeysMap } from "./ciqualKeys.js";

const url =
  "https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202020_FR_2020%2007%2007.xls";

(async function download() {
  console.log("...downloading");
  const tStart = performance.now();

  const response = await fetch(url);
  const buffer = await response.buffer();
  const result = xlsx.read(buffer);

  console.log("...parsing");

  const sheetName = result.SheetNames?.[0];
  const sheet = result.Sheets[sheetName];
  const alims: Record<string, string>[] = xlsx.utils.sheet_to_json(sheet);
  const parsedAlims = alims.map((a) => {
    const parsed = Object.entries(a).reduce((acc, [k, v]) => {
      const newAcc = { ...acc };
      const baseKey = baseKeysMap[k as keyof typeof baseKeysMap];
      if (baseKey) {
        newAcc[baseKey] = v;
      } else {
        const compKey = compoKeysMap[k as keyof typeof compoKeysMap];
        if (compKey) {
          newAcc.compo = {
            ...((newAcc.compo as any) || {}),
            [compKey]: v,
          };
        }
      }
      return newAcc;
    }, {} as Record<string, string>);
    return parsed;
  });

  console.log("...writing JSON file");

  if (!existsSync("./data")) {
    await promisify(mkdir)("./data");
  }
  const write = promisify(writeFile);
  await write("./data/ciqual.json", JSON.stringify(parsedAlims));

  console.log("...creating compo references");

  const compoRefs = Object.entries(compoKeysMap).reduce((acc, [k, v]) => {
    const newAcc = { ...acc };
    newAcc[v] = k;
    return newAcc;
  }, {} as any);

  await write("./data/compoRefs.json", JSON.stringify(compoRefs));

  const tEnd = performance.now();
  const execTime = Math.trunc(tEnd - tStart);

  console.log(`...done in ${execTime}ms`);
})();
