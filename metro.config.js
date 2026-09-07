// Expo's Metro configuration, with one addition: how many transform workers
// to spawn is decided by the build, not by the host's core count. A 2-CPU
// job on a 32-core host would otherwise start a worker per core and run out
// of memory while bundling. scripts/android/build.sh sets METRO_MAX_WORKERS.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const workers = Number(process.env.METRO_MAX_WORKERS);
if (Number.isInteger(workers) && workers > 0) config.maxWorkers = workers;

module.exports = config;
