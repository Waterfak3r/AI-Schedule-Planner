const { startServer } = require("./appServer");

startServer()
  .then(({ url }) => {
    console.log(`Server running: ${url}`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
