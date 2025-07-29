const { spawn } = require("child_process");
const fs = require("fs").promises;
const fs_sync = require("fs");
const os = require("os");
const { once } = require("events");
const path = require("path");
const { profile } = require("console");

const createLogger = (prefix) => (chunk) => {
  const fullPrefix = `${prefix}`;

  // Split the chunk into lines, add the prefix to each line, and join them back
  const formattedChunk = chunk
    .toString()
    .split("\n")
    .map((line) => (line ? `${fullPrefix} ${line}` : "")) // Avoid prefixing empty lines
    .join("\n");

  process.stdout.write(formattedChunk + "\n"); // Ensure final newline
};

const handleProcessOutput = (childProcess, options) => {
  return new Promise((resolve, reject) => {
    const {
      prefix,
      resolvePatterns = [],
      rejectPatterns = [],
      closeMessage,
      pipeCallback,
    } = options;
    const log = createLogger(prefix);
    childProcess.stdout.on("data", (chunk) => {
      // Call the pipeCallback if provided to show all process output
      if (pipeCallback) {
        pipeCallback(chunk);
      }

      // Check for reject patterns
      for (const pattern of rejectPatterns) {
        const match = chunk.toString().match(pattern); // Capture the matched data
        if (match) {
          reject(
            new Error(
              `${prefix}: reject pattern ${pattern} failed with match: ${match}`,
              {
                pattern,
                match,
              },
            ),
          );
          return;
        }
      }

      // Check if any resolve patterns match
      for (const pattern of resolvePatterns) {
        const match = chunk.toString().match(pattern); // Capture the matched data
        if (match) {
          resolve({ pattern, match }); // Resolve when the expected output is found
          return;
        }
      }
    });

    // Handle process close event
    childProcess.on("close", (code, signal) => {
      if (signal) {
        log(`was terminated by signal: ${signal}`);
      }
      if (closeMessage) {
        log(closeMessage);
      }
    });

    // Handle any errors that occur during execution
    childProcess.on("error", (err) => {
      log(`encountered an error: ${err}`);
      reject(err); // Reject the promise in case of error
    });
  });
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true; // File exists
  } catch {
    return false; // File does not exist
  }
};

const isCfLoggedIn = async (options = {}) => {
  const { verboseOutput = false } = options;
  const outputOptions = {
    prefix: `[isCfLoggedIn]`,
    resolvePatterns: [/name.*offering/],
    rejectPatterns: [/FAILED/i],
  };
  const log = createLogger(outputOptions.prefix);
  outputOptions.pipeCallback = verboseOutput ? log : undefined;
  const service = spawn("cf", ["services"], { shell: true });
  service.stdout.setEncoding("utf8");

  try {
    await handleProcessOutput(service, outputOptions);
    log("User is logged in to Cloud Foundry.");
    return true;
  } catch (error) {
    log("User is NOT logged in to Cloud Foundry.");
    return false;
  }
};

const downloadDefaultEnv = async (serviceName, servicePath, options = {}) => {
  const { verboseOutput = false } = options;
  const outputOptions = {
    prefix: `[downloadDefaultEnv][${servicePath}]`,
    resolvePatterns: [/Writing environment of .*/],
  };
  const log = createLogger(outputOptions.prefix);
  outputOptions.pipeCallback = verboseOutput ? log : undefined;
  const service = spawn("node", ["default-env.js", serviceName, "2>&1"], {
    shell: true,
    cwd: path.resolve(__dirname, servicePath),
    stdio: ["inherit", "pipe", "pipe"],
  });
  service.stdout.setEncoding("utf8");

  await handleProcessOutput(service, outputOptions);
  log(`default-env.json written for ${serviceName} to ${servicePath}`);
};

const bindService = async (
  remoteServiceName,
  servicePath,
  cdsrcExists,
  options = {},
) => {
  const outputOptions = {
    prefix: `[bindService][${servicePath}]`,
    resolvePatterns: [
      new RegExp(
        `Saving bindings to .cdsrc-private.json in profile ${options.profile}`,
      ),
    ],
  };
  const log = createLogger(outputOptions.prefix);
  outputOptions.pipeCallback = options.verboseOutput ? log : undefined;
  const cdsrcContent = cdsrcExists
    ? await fs.readFile(`${servicePath}/.cdsrc-private.json`, "utf8")
    : "";
  if (cdsrcExists && cdsrcContent.includes(remoteServiceName)) {
    options.verboseOutput &&
      log(
        `${servicePath}/.cdsrc-private.json already exists. Skipping binding of ${remoteServiceName}.`,
      );
    return;
  }

  log(`bind ${remoteServiceName} to ${servicePath}`);
  const service = spawn("cds", ["bind", "-2", remoteServiceName, "2>&1"], {
    shell: true,
    cwd: path.resolve(__dirname, servicePath),
    stdio: ["inherit", "pipe", "pipe"],
  });
  service.stdout.setEncoding("utf8");

  await handleProcessOutput(service, outputOptions);
  log("Saving bindings to .cdsrc-private.json in profile hybrid");
  await once(service, "close"); // Wait for the process to exit
};

const ensureKeyExists = (obj, keys) => {
  return keys.reduce((acc, key) => {
    if (!acc[key]) {
      acc[key] = {};
    }
    return acc[key];
  }, obj);
};

const bindServices = async (service, servicePath, options = {}) => {
  const { verboseOutput = false } = options;
  const outputOptions = {
    prefix: `[bindServices][${servicePath}]`,
  };
  const log = createLogger(outputOptions.prefix);
  try {
    log(`Binding services ${service}`);
    const filePath = `${servicePath}/.cdsrc-private.json`;
    const cdsrcExists = await fileExists(filePath);

    await downloadDefaultEnv(service, servicePath);
    for (const boundService of options.boundServices) {
      await bindService(boundService, servicePath, cdsrcExists, {
        verboseOutput: verboseOutput,
        profile: options.profile,
      });
    }
  } catch (error) {
    log(`Error binding services or adding DB pool configuration: ${error}`);
    throw error;
  }
};

const downloadCredentials = async (options) => {
  const { verboseOutput = false } = options;
  const outputOptions = {
    prefix: `[downloadCredentials]`,
  };
  const log = createLogger(outputOptions.prefix);
  try {
    log(`Downloading credentials`);
    const bindServicesPromises = options.services.map((service) => {
      return bindServices(service.name, options.basePath + service.path, {
        verboseOutput: verboseOutput,
        boundServices: service.boundServices,
        profile: options.profile,
      });
    });
    await Promise.all(bindServicesPromises);
    log("All credentials downloaded successfully.");
  } catch (error) {
    log(`An error occurred during download of credentials: ${error}`);
    throw error;
  }
};

const loadService = async (servicePath, options) => {
  const {
    port,
    debugPort = Number(port) + 1000,
    winDelay = 500,
    debug,
    resolvePatterns = [],
    rejectPatterns = [],
    verboseOutput = false,
  } = options;
  const outputOptions = {
    prefix: `[loadService][${servicePath}]`,
    resolvePatterns,
    rejectPatterns,
  };
  const log = createLogger(outputOptions.prefix);
  outputOptions.pipeCallback = verboseOutput ? log : undefined;
  if (os.platform() === "win32") {
    if (verboseOutput) {
      log(`Windows: This loadService will be delayed by ${winDelay}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, winDelay));
  }

  const debugOption = debug ? `--debug ${debugPort}` : "";

  if (verboseOutput) {
    log(`Starting service ${servicePath} on port ${port}`);
  }
  const service = spawn(
    "cds",
    [
      "watch",
      "--port",
      port,
      "--profile",
      options.profile,
      "--livereload",
      "true",
      debugOption,
      "2>&1", // Redirects stderr to stdout
    ],
    {
      shell: true,
      cwd: path.resolve(__dirname, servicePath),
      stdio: ["inherit", "pipe", "pipe"],
    },
  );
  service.stdout.setEncoding("utf8");

  await handleProcessOutput(service, outputOptions);
  log(`Service ${servicePath} listening on 'http://localhost:${port}'`);
  debug &&
    log(
      `Service ${servicePath} debugging enabled on 'http://localhost:${debugPort}'`,
    );

  return service;
};

const loadServices = async (serviceTasks, sequential = false) => {
  const spawnedProcesses = [];
  if (sequential) {
    await serviceTasks.reduce(async (prevPromise, spec) => {
      await prevPromise; // Wait for the previous service to finish
      const service = await loadService(spec.name, spec.options);
      spawnedProcesses.push(service);
    }, Promise.resolve()); // Kick-off loading by resolving initial promise
  } else {
    await Promise.all(
      serviceTasks.map(async (spec) => {
        const service = await loadService(spec.name, spec.options);
        spawnedProcesses.push(service);
      }),
    );
  }
  return spawnedProcesses;
};

const loadServer = async (options = {}) => {
  const { verboseOutput = false } = options;
  const outputOptions = {
    prefix: `[loadServer][Approuter]`,
    resolvePatterns: [/Application router is listening on port/],
    rejectPatterns: [/error/, /\[EADDRINUSE\].*/],
  };
  const log = createLogger(outputOptions.prefix);
  outputOptions.pipeCallback = verboseOutput ? log : undefined;

  verboseOutput && log(`Starting Application Router`);
  const approuter = spawn(
    "cds",
    ["bind", "--exec", "--", "npm", "start", "--prefix", "./router", "2>&1"],
    {
      shell: true,
      cwd: path.resolve(__dirname, options.path),
      stdio: ["inherit", "pipe", "pipe"],
    },
  );
  approuter.stdout.setEncoding("utf8");

  await handleProcessOutput(approuter, outputOptions);
  log(`Application Router listening on url: 'http://localhost:8008'`);
  log(
    `For opening local launchpad: 'http://localhost:8008/$launchpad?sap-ui-xx-viewCache=false'`,
  );
  return approuter;
};

const createShutdownHandler = (spawnedProcesses, options = {}) => {
  const { verboseOutput = false } = options;
  let shuttingDown = false;

  return async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log("\nShutting down services...");

    spawnedProcesses.forEach((proc) => {
      if (proc) {
        verboseOutput &&
          console.log(
            `Attempting to terminate process ${proc.pid}, spawnargs: ${proc.spawnargs}`,
          );
        try {
          proc.kill("SIGTERM");
          verboseOutput &&
            console.log(`Successfully sent SIGTERM to process ${proc.pid}`);
        } catch (err) {
          console.error(`Error terminating process ${proc.pid}:`, err);
          try {
            proc.kill("SIGKILL"); // Forceful termination if SIGTERM fails
            verboseOutput &&
              console.log(`Forcefully killed process ${proc.pid}`);
          } catch (sigkillerr) {
            console.error(
              `Error forcefully terminating process ${proc.pid}:`,
              sigkillerr,
            );
          }
        }
      }
    });
    // Wait for processes to finish terminating
    await Promise.all(
      spawnedProcesses.map(
        (proc) =>
          new Promise((resolve) => {
            if (proc) {
              proc.on("exit", () => {
                verboseOutput && console.log(`Process ${proc.pid} has exited.`);
                resolve();
              });
            } else {
              resolve();
            }
          }),
      ),
    );
  };
};

const showHelp = () => {
  const scriptname = path.basename(process.argv[1]);
  console.log(`
    Usage: node ${scriptname} [options]
    
    Options:
      --debug                Enable Node.js debug mode
      --with-bindings-update Include bindings setup
      --parallel             Enable parallel loading of services (faster startup)
      --verbose              Enable verbose output
      --help                 Show this help message and exit

  `);
};

const showParallelHints = () => {
  console.log(`
    Notes on the --parallel option:
      Running in parallel may cause issues due to system limits on open files or file watchers.
      
      - **Linux**: Increase file watcher limit temporarily:
          echo 524288 | sudo tee /proc/sys/fs/inotify/max_user_watches
        To make it permanent, add this to /etc/sysctl.conf:
          fs.inotify.max_user_watches=524288
        Then apply changes with:
          sudo sysctl -p

        Increase open file limits (soft and hard):
          echo "your-username  soft  nofile  1000000" | sudo tee -a /etc/security/limits.conf
          echo "your-username  hard  nofile  1000000" | sudo tee -a /etc/security/limits.conf
        Ensure PAM applies these limits:
          grep pam_limits /etc/pam.d/common-session || echo "session required pam_limits.so" | sudo tee -a /etc/pam.d/common-session

      - **macOS**: WARNING: These settings are not validated, consult the macOS documentation!
        Increase file watcher limit temporarily:
          sudo sysctl -w kern.maxfiles=524288
          sudo sysctl -w kern.maxfilesperproc=524288
        To make it permanent, add to /etc/sysctl.conf:
          kern.maxfiles=524288
          kern.maxfilesperproc=524288
        Then apply:
          sudo sysctl -p

        Increase open file limits:
          sudo launchctl limit maxfiles 524288 524288
        To persist across reboots, create or edit:
          sudo nano /Library/LaunchDaemons/limit.maxfiles.plist
        Add:
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
            <key>Label</key>
            <string>limit.maxfiles</string>
            <key>ProgramArguments</key>
            <array>
                <string>launchctl</string>
                <string>limit</string>
                <string>maxfiles</string>
                <string>524288</string>
                <string>524288</string>
            </array>
            <key>RunAtLoad</key>
            <true/>
        </dict>
        </plist>
        Then apply:
          sudo launchctl load -w /Library/LaunchDaemons/limit.maxfiles.plist

      - **Windows**: No real solution here:
          Best workaround is running inside WSL and increasing Linux limits there
  `);
};

const showTroubleshootingHints = () => {
  console.log(`
    Troubleshooting:  
      If the script didn't shut down properly and some processes are still running, you can manually find and terminate them:  

      - List leftover processes:  
          pgrep -f "@sap/cds-dk/lib/watch/watched" -a  

      - Try a graceful shutdown first:  
          pgrep -f "@sap/cds-dk/lib/watch/watched" | xargs kill  

      - If processes don't terminate, forcefully kill them:  
          pgrep -f "@sap/cds-dk/lib/watch/watched" | xargs kill -9  

      Use \`kill -9\` only if necessary, as it forcefully stops processes without allowing cleanup.    
  `);
};

const main = async (options) => {
  const spawnedProcesses = [];
  const t0 = performance.now();
  const myArgs = process.argv.slice(2);
  const isWindows = os.platform() === "win32";
  if (myArgs.includes("--help")) {
    showHelp();
    return;
  }
  const userArgs = {
    debug: myArgs.includes("--debug") || options.debug,
    withBindingsUpdate:
      myArgs.includes("--with-bindings-update") || options.withBindingsUpdate,
    parallel: myArgs.includes("--parallel") || options.parallel,
    verboseOutput: myArgs.includes("--verbose") || options.verboseOutput,
    profile: myArgs.includes("--profile"),
  };

  if (userArgs.profile) {
    options.profile = myArgs[myArgs.indexOf("--profile") + 1];
  }

  const shutdown = createShutdownHandler(spawnedProcesses, {
    verboseOutput: userArgs.verboseOutput,
  });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("exit", shutdown);
  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    shutdown();
  });

  try {
    console.log(`Running with parameters:`, userArgs);

    //resolve and reject patterns configure handleProcessOutput
    //possible outcomes:
    //- a matched resolvePattern regex resolves the promise
    //- a matched rejectPattern regex rejects the promise with an error
    const defaultServiceOptions = {
      winDelay: 100,
      debug: userArgs.debug,
      verboseOutput: userArgs.verboseOutput,
      resolvePatterns: [/server listening on/],
      rejectPatterns: [/error/, /\[EADDRINUSE\].*/],
    };

    const serviceTasks = options.services.map((service) => {
      return {
        name: options.basePath + service.path,
        options: {
          ...defaultServiceOptions,
          port: service.port,
          profile: options.profile,
        },
      };
    });

    const loggedIn = await isCfLoggedIn();
    if (!loggedIn) {
      process.exit(0);
      return;
    }

    const setupAndBuildTasks = [];
    userArgs.withBindingsUpdate && setupAndBuildTasks.push(downloadCredentials);

    // Execute setup and build steps in parallel
    await Promise.all(
      setupAndBuildTasks.map((task) =>
        task({ verboseOutput: userArgs.verboseOutput, ...options }),
      ),
    );

    // Load services and track processes
    const loadSequentially = !userArgs.parallel || isWindows;
    const services = await loadServices(serviceTasks, loadSequentially);
    spawnedProcesses.push(...services);

    // Finally load approuter
    const approuterOptions = { path: options.basePath + options.approuterPath };
    const approuter = await loadServer(approuterOptions);
    spawnedProcesses.push(approuter);

    const t1 = performance.now();
    const startupTime = ((t1 - t0) / 1000).toPrecision(3);
    console.log(`Startup took ${startupTime} seconds`);
    console.log("\nterminate with Ctrl+C");
  } catch (error) {
    await shutdown();
    !userArgs.verboseOutput &&
      console.error("Use --verbose flag to get detailed output");
    userArgs.verboseOutput && showTroubleshootingHints();
    userArgs.verboseOutput && userArgs.parallel && showParallelHints();
    console.error(error);
    console.log("\nterminate with Ctrl+C");
  }
};

const packageJson = JSON.parse(fs_sync.readFileSync("package.json", "utf8"));

const options = packageJson.bootstrap;

main(options);
