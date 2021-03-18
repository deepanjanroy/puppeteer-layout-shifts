const { getAllClsForUrl, calcMedian } = require('./cls_utils');
const { appendFile } = require('fs').promises;

(async () => {
  const args = process.argv.slice(2);
  const numRuns = args[0];
  const expectedValue = args[1];
  const chromePath = args[2];
  const url = args[3];
  const intermediateOutputFile = args[4];
  console.log({numRuns, chromePath, url});
  if (numRuns < 1) {
    throw Error('must have at least 1 run');
  }

  const values = await getAllClsForUrl(numRuns, chromePath, url);
  const medianCLS = calcMedian(values);
  // 1% of expectedValue, but clamped between 0.001 and 0.01.
  const epsilon = Math.min(Math.max(expectedValue * 0.01, 0.001), 0.01);

  let outcome = Math.abs(medianCLS - expectedValue) < epsilon ? 'Good': 'Bad';
  await appendFile(intermediateOutputFile, JSON.stringify(
    {chromePath, values, medianCLS, expectedValue, epsilon, outcome}) + '\n');
  console.log({values, epsilon, medianCLS, expectedValue, outcome});
  process.exit(outcome === 'Good' ? 0 : 1);
})();
