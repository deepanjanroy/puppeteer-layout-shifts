from __future__ import print_function

import argparse
import csv
import glob
import json
import os

def get_all_out_files(outdir):
  return glob.glob(os.path.join(outdir, '*.bisect.txt'))

def process_out_file(outfile):
  """outfile => {url, bisect_result}"""

  ret = {}
  with open(outfile) as f:
    firstline = f.readline()
    try:
      metadata = json.loads(firstline)
    except:
      print('Could not process ' + outfile)
      return
    ret['url'] = metadata['url']
    changelog_found = False
    for line in f:
      if line.startswith('CHANGELOG URL:'):
        changelog_found = True
        continue
      if changelog_found:
        ret['changelog'] = line.strip()
        break
    else:
      ret['changelog'] = 'Failed bisect'
  return ret

def write_results(results, outfile):
  with open(outfile, 'w') as f:
    writer = csv.DictWriter(f, ['url', 'changelog'])
    writer.writeheader()
    writer.writerows(results)
  print('Wrote {0} rows to {1}'.format(len(results), outfile))


def main():
  parser = argparse.ArgumentParser()
  parser.add_argument('results_dir', type=str,
                      help='Input directory of bisect results')
  parser.add_argument('--outfile', type=str, default=None,
                      help='out dir (default: results_dir/../'
                           'basename(results_dir).result.csv)')

  args = parser.parse_args()
  args.outdir = os.path.expanduser(args.results_dir)
  if args.outfile is None:
    basename = os.path.basename(args.outdir)
    args.outfile = os.path.join(os.path.dirname(args.outdir),
                                basename + '.result.csv')

  all_out_files = get_all_out_files(args.outdir)
  results = [process_out_file(f) for f in all_out_files]
  write_results(results, args.outfile)


if __name__ == '__main__':
  main()
