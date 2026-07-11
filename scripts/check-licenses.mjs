const allowed = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "ISC",
  "MIT",
  "OFL-1.1",
  "Unlicense",
]);

let input = "";
for await (const chunk of process.stdin) input += chunk;
const inventory = JSON.parse(input);
const rejected = Object.keys(inventory).filter((license) => !allowed.has(license));
if (rejected.length > 0) {
  console.error(`Unreviewed production licenses: ${rejected.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`Production dependency licenses approved: ${Object.keys(inventory).join(", ")}`);
}
