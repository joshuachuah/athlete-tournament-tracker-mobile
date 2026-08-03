import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = path.join(projectRoot, "ios", "AthleteTracker.xcworkspace");
const derivedData = path.join(os.tmpdir(), "athlete-tracker-ios-simulator");
const buildOnly = process.argv.includes("--build-only");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function findBootedIphoneSimulator() {
  const result = spawnSync("xcrun", ["simctl", "list", "devices", "booted", "--json"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  const runtimes = JSON.parse(result.stdout).devices;
  const simulators = Object.entries(runtimes)
    .filter(([runtime]) => runtime.includes(".iOS-"))
    .flatMap(([, devices]) => devices)
    .filter((device) => device.state === "Booted" && device.name.startsWith("iPhone"));

  if (simulators.length === 0) {
    console.error("No booted iPhone Simulator found. Open Simulator, boot an iPhone, and try again.");
    process.exit(1);
  }

  return simulators[0];
}

if (!existsSync(workspace)) {
  console.log("Generating the native iOS project...");
  run("pnpm", ["exec", "expo", "prebuild", "--platform", "ios"]);
}

const simulator = findBootedIphoneSimulator();

if (!buildOnly) {
  console.log(`Building and opening Athlete Tracker on ${simulator.name}...`);
  run("pnpm", ["exec", "expo", "run:ios", "--device", simulator.udid]);
  process.exit(0);
}

const appPath = path.join(
  derivedData,
  "Build",
  "Products",
  "Debug-iphonesimulator",
  "AthleteTracker.app",
);

console.log(`Building Athlete Tracker for ${simulator.name}...`);
run("xcodebuild", [
  "-workspace",
  workspace,
  "-scheme",
  "AthleteTracker",
  "-configuration",
  "Debug",
  "-destination",
  `platform=iOS Simulator,id=${simulator.udid}`,
  "-derivedDataPath",
  derivedData,
  "-quiet",
  "build",
  "CODE_SIGN_IDENTITY=-",
  "AD_HOC_CODE_SIGNING_ALLOWED=YES",
]);

console.log(`Installing the build-only app on ${simulator.name}...`);
run("xcrun", ["simctl", "install", simulator.udid, appPath]);
console.log("Simulator build and installation succeeded.");
