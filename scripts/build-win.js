const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");

const rootDir = path.join(__dirname, "..");
const packageJson = require(path.join(rootDir, "package.json"));
const releaseDir = path.join(rootDir, "release");
const prepackagedDir = path.join(releaseDir, "prepackaged-win");
const resourcesAppDir = path.join(prepackagedDir, "resources", "app");
const electronDistDir = path.join(rootDir, "node_modules", "electron", "dist");
const productName = packageJson.build?.productName || packageJson.name || "Electron App";
const productExeName = `${productName}.exe`;
const deliverablesExeDir = path.join(rootDir, "deliverables", "exe");

async function removeIfExists(targetPath) {
  await fsp.rm(targetPath, { recursive: true, force: true });
}

async function copyRecursive(sourcePath, targetPath) {
  await fsp.cp(sourcePath, targetPath, { recursive: true, force: true });
}

function resolveBuildEntries() {
  const rawEntries = Array.isArray(packageJson.build?.files) ? packageJson.build.files : [];
  return rawEntries.map((entry) => {
    const normalized = String(entry).replace(/\\/g, "/");
    if (normalized.endsWith("/**/*")) {
      return { type: "dir", relativePath: normalized.slice(0, -"/**/*".length) };
    }
    return { type: "file", relativePath: normalized };
  });
}

async function stageAppFiles() {
  const entries = resolveBuildEntries();
  for (const entry of entries) {
    const sourcePath = path.join(rootDir, entry.relativePath);
    const targetPath = path.join(resourcesAppDir, entry.relativePath);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing build input: ${entry.relativePath}`);
    }

    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    if (entry.type === "dir") {
      await copyRecursive(sourcePath, targetPath);
    } else {
      await fsp.copyFile(sourcePath, targetPath);
    }
  }
}

async function preparePrepackagedApp() {
  if (!fs.existsSync(electronDistDir)) {
    throw new Error(`Electron dist folder not found: ${electronDistDir}`);
  }

  await removeIfExists(prepackagedDir);
  await copyRecursive(electronDistDir, prepackagedDir);

  const electronExePath = path.join(prepackagedDir, "electron.exe");
  const productExePath = path.join(prepackagedDir, productExeName);
  if (!fs.existsSync(electronExePath)) {
    throw new Error(`Expected electron.exe inside prepackaged app: ${electronExePath}`);
  }

  await fsp.rename(electronExePath, productExePath);
  await fsp.mkdir(resourcesAppDir, { recursive: true });
  await stageAppFiles();
}

function runElectronBuilder() {
  return new Promise((resolve, reject) => {
    const builderBin = path.join(rootDir, "node_modules", ".bin", "electron-builder.cmd");
    const child = spawn(builderBin, ["--win", "nsis", "--prepackaged", prepackagedDir], {
      cwd: rootDir,
      stdio: "inherit",
      shell: true,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`electron-builder exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

async function collectInstallerArtifacts() {
  await fsp.mkdir(deliverablesExeDir, { recursive: true });
  const files = await fsp.readdir(releaseDir, { withFileTypes: true });

  for (const file of files) {
    if (!file.isFile()) continue;
    if (!file.name.startsWith(productName)) continue;
    if (!file.name.endsWith(".exe") && !file.name.endsWith(".exe.blockmap")) continue;
    const sourcePath = path.join(releaseDir, file.name);
    const targetPath = path.join(deliverablesExeDir, file.name);
    await fsp.copyFile(sourcePath, targetPath);
  }
}

async function main() {
  console.log("[build-win] preparing prepackaged Electron app");
  await preparePrepackagedApp();
  console.log("[build-win] running electron-builder");
  await runElectronBuilder();
  console.log("[build-win] copying installer artifacts to deliverables/exe");
  await collectInstallerArtifacts();
  console.log("[build-win] done");
}

main().catch((error) => {
  console.error(`[build-win] failed: ${error.message}`);
  process.exitCode = 1;
});
