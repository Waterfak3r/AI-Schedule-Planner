const { startServer } = require("./appServer");

let serverControl = null;

async function shutdown() {
  if (!serverControl) return;

  try {
    await serverControl.close();
  } catch {
    // Ignore shutdown errors during process exit.
  } finally {
    serverControl = null;
  }
}

startServer()
  .then((control) => {
    serverControl = control;
    console.log(`Server running: ${control.url}`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

process.on("SIGINT", () => {
  shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  shutdown().finally(() => process.exit(0));
});
