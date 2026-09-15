// Namecheap's Node.js app loader uses CommonJS require().
// Keep the application source as ESM and bridge into it from a CommonJS entry point.
import("./src/server.js").catch((error) => {
  console.error("Unable to start Slackbrahs Fantasy Tool:", error);
  process.exitCode = 1;
});
