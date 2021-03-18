const fs = require('fs');
const cls_utils = require('./cls_utils');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const path = require("path");
const {default: PQueue} = require('p-queue');

const fsp = fs.promises;

const BISECT_CHECKER_SCRIPT = 'check_cls_almost_equal.js';

function txtFilename(url, rangeStart, rangeEnd, suffix) {
  return [url.replace(/[\W]/g, '_'), rangeStart, rangeEnd].join('_') + `.${suffix}.txt`;
}

function getOutFileName(url, rangeStart, rangeEnd, outDir, suffix) {
  if (!outDir.endsWith('/')) {
    outDir = outDir + '/';
  }

  return outDir + txtFilename(url, rangeStart, rangeEnd, suffix);
}

function leftFillNum(num, targetLength) {
  return num.toString().padStart(targetLength, 0);
}

async function fileExists(filename) {
  try {
    await fsp.access(filename);
    return true;
  } catch {
    return false;
  }
}

const tmpDirectoriesToRemove = new Set();

async function bisectUrl(url, {rangeStart, rangeEnd, bisectBuildPath,
                    outDir, numRuns, baseChromePath}, logPrefix) {
  const prefixedLog = (...logArgs) => console.log(logPrefix, ...logArgs);


  // Setup directories and output files.
  const outFile = getOutFileName(url, rangeStart, rangeEnd, outDir, 'bisect');
  if (await fileExists(outFile)) {
    prefixedLog('SKIP: Output already exists.')
    return;
  }
  const intermediateFile = getOutFileName(url, rangeStart, rangeEnd, outDir, 'intermediate');
  await fsp.mkdir(outDir, {recursive: true});
  await fsp.writeFile(intermediateFile, '');  // Truncate file.
  const tmpdir = await fsp.mkdtemp('/tmp/cls-bisect-');
  tmpDirectoriesToRemove.add(tmpdir);


  // Calculate base value.
  prefixedLog('Computing base value');
  const values = await cls_utils.getAllClsForUrl(numRuns, baseChromePath, url);
  const baseValue = cls_utils.calcMedian(values);
  if (baseValue === undefined) {
    prefixedLog(`Could not compute median. Values: ${values}`);
    return;
  }
  prefixedLog(`Median base value: ${baseValue}`);




  // Launch bisect command.
  const checkerScript = path.join(__dirname, BISECT_CHECKER_SCRIPT);
  const bisectCmd = `python ${bisectBuildPath} --archive=linux64 --use-local-cache` +
  ` --good=${rangeStart} --bad=${rangeEnd}` +
  ` --command="node ${checkerScript} ${numRuns} ${baseValue} %p ${url}` +
  ` ${path.resolve(intermediateFile)}" --not-interactive --verify-range`;
  prefixedLog(`Launching bisect: ${bisectCmd} with working dir ${tmpdir}`);
  const {stdout, stderr} = await exec(bisectCmd, {cwd: tmpdir});


  // Write output.
  const metadata = {
    url,
    rangeStart,
    rangeEnd,
    baseChromePath,
    intermediateFile,
  };
  output = [JSON.stringify(metadata), '---bisect output---', stdout, stderr];
  await fsp.writeFile(outFile, output.join('\n'));
  prefixedLog(`Output written to ${outFile}`);

  // Cleanup tmp directories.
  await fsp.rmdir(tmpdir, {recursive: true});
  tmpDirectoriesToRemove.delete(tmpdir);
}

async function main() {
  // Process arguments.
  const rawArgs = process.argv.slice(2);
  const args = {
    numRuns: rawArgs[0],
    outDir: rawArgs[1],
    bisectBuildPath: rawArgs[2],
    urlFile: rawArgs[3],
    // Chrome binary to use to get the base value.
    baseChromePath: rawArgs[4],
    rangeStart: rawArgs[5],
    rangeEnd: rawArgs[6],
  }

  const data = fs.readFileSync(args.urlFile, 'utf8');
  const urls = data.split(/\s/)
    .map(x => x.trim())
    .filter(x => x.length > 0);

  const concurrency = 10;
  const queue = new PQueue({ concurrency});
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const logPrefix = `[${leftFillNum(i + 1, 3)}/` +
      `${leftFillNum(urls.length, 3)} ${url}]`;
    queue.add(async () => bisectUrl(url, args, logPrefix));
  }

  process.setMaxListeners(concurrency + 1);
  process.on('SIGINT', () => queue.clear());
  process.on('exit', () => {
    console.log(`Cleaning up ${tmpDirectoriesToRemove.size} ` +
      `temporary directories`);
    for (const tmpdir of tmpDirectoriesToRemove) {
      fs.rmdirSync(tmpdir, {recursive: true});
    }
  });

  queue.start();
  await queue.onIdle();
}

if (require.main === module) {
  main();
}
