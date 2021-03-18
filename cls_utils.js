const { getCLS } = require('./puppeteer_cls');

async function getAllClsForUrl(numRuns, chromePath, url) {
  const values = [];
  for (let i = 0; i < numRuns; i++) {
    value = await getCLS(url, undefined, chromePath);
    values.push(value);
  }
  return values;
}

function calcMedian(vals) {
  if (vals.length == 0) {
    return NaN;
  } else if (vals.length == 1) {
    return vals[0];
  }

  vals.sort(function(a, b){return a - b;});
  var half = Math.floor(vals.length / 2);
  if (vals.length % 2) {
    return vals[half];
  }

  return (vals[half - 1] + vals[half]) / 2.0;
}

module.exports = {
  getAllClsForUrl,
  calcMedian,
}
