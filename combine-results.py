from __future__ import print_function

import argparse
import csv
import os

from collections import OrderedDict, defaultdict

def read_result_file(infile):
  rows = []
  colname = os.path.basename(infile).split('.')[0]
  with open(infile) as f:
    reader = csv.DictReader(f)
    for row in reader:
      rows.append({
        'url': row['url'],
        colname: row['changelog'],
      })
  return rows

def write_results(result_lists, outfile):
  fields = OrderedDict()
  fields['url'] = None
  combined_results = defaultdict(dict)

  for results in result_lists:
    for row in results:
      combined_row = combined_results[row['url']]
      for key, value in row.items():
        fields[key] = None
        combined_row[key] = value


  with open(outfile, 'w') as f:
    writer = csv.DictWriter(f, list(fields.keys()), restval='Did not bisect')
    writer.writeheader()
    writer.writerows(combined_results.values())

  print('Combined {0} files to {1} rows in {2}'.format(
    len(result_lists), len(combined_results), outfile))


def main():
  parser = argparse.ArgumentParser()
  parser.add_argument('result_files', type=str, nargs='+',
                      help='List of input result files')
  parser.add_argument('--outfile', type=str,
                      required=True,
                      help='Combined output filename')

  args = parser.parse_args()
  result_lists = [read_result_file(f) for f in args.result_files]
  write_results(result_lists, args.outfile)

if __name__ == '__main__':
  main()
