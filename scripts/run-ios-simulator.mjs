import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = path.join(projectRoot, "ios", "AthleteTracker.xcworkspace");
const derivedData = path.join(os.tmpdir(), "athlete-tracker-ios-simulator");
const buildOnly = process.argv.includes("--build-only");
const appConfig = JSON.parse(
  readFileSync(path.join(projectRoot, "app.json"), "utf8"),
);
const bundleIdentifier = appConfig.expo.ios.bundleIdentifier;

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

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function metroIsReady() {
  try {
    const response = await fetch("http://127.0.0.1:8081/status", {
      signal: AbortSignal.timeout(1_000),
    });
    return (
      response.ok &&
      (await response.text()).includes("packager-status:running")
    );
  } catch {
    return false;
  }
}

async function startMetro() {
  if (await metroIsReady()) {
    return null;
  }

  const metro = spawn(
    "pnpm",
    ["exec", "expo", "start", "--localhost", "--port", "8081"],
    { cwd: projectRoot, stdio: "inherit" },
  );

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await metroIsReady()) {
      return metro;
    }

    if (metro.exitCode !== null) {
      process.exit(metro.exitCode ?? 1);
    }

    await delay(500);
  }

  metro.kill();
  console.error("Metro did not become ready on port 8081 within 60 seconds.");
  process.exit(1);
}

if (!existsSync(workspace)) {
  console.log("Generating the native iOS project...");
  run("pnpm", ["exec", "expo", "prebuild", "--platform", "ios"]);
}

const simulator = findBootedIphoneSimulator();
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

console.log(`Installing on ${simulator.name}...`);
run("xcrun", ["simctl", "install", simulator.udid, appPath]);

if (buildOnly) {
  console.log("Simulator build and installation succeeded.");
  process.exit(0);
}

console.log(`Starting Metro and opening Athlete Tracker on ${simulator.name}...`);
const metro = await startMetro();
run("xcrun", ["simctl", "launch", simulator.udid, bundleIdentifier]);

if (metro) {
  const stopMetro = () => metro.kill("SIGINT");
  process.once("SIGINT", stopMetro);
  process.once("SIGTERM", stopMetro);
  await new Promise((resolve) => metro.once("exit", resolve));
}
