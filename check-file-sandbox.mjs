import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { LocalSandbox } from '@mastra/core/workspace';

const parent = await mkdtemp('/tmp/powerxi-file-test-');
const root = join(parent, 'workspace');
const input = join(root, 'inputs');
const output = join(root, 'outputs');
const scratch = join(root, 'scratch');
const privateFile = join(parent, 'outside.txt');
for (const directory of [input, output, scratch]) await mkdir(directory, { recursive: true });
await writeFile(join(input, 'values.csv'), 'a,b\n2,3\n4,5\n');
await writeFile(privateFile, 'outside sandbox');
const listener = createServer((req, res) => res.end('outside network'));
await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
assert.equal(await (await fetch(`http://127.0.0.1:${listener.address().port}`)).text(), 'outside network');
const isolation = await LocalSandbox.detectIsolation();
assert.equal(isolation.available, true);
assert.equal(isolation.backend, 'bwrap');
const sandbox = new LocalSandbox({ id: 'docker-file-test', workingDirectory: root, isolation: isolation.backend,
  env: { PATH: '/opt/workspace-python/bin:/usr/local/bin:/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1', TMPDIR: scratch },
  nativeSandbox: { allowNetwork: false, readOnly: true, readWritePaths: [output, scratch], readOnlyPaths: ['/opt/workspace-python', '/usr/local/lib'] },
});
try {
  const code = `
import csv, socket, sys
from pathlib import Path
from openpyxl import Workbook
with open('inputs/values.csv') as stream:
    values = [sum(int(field) for field in row) for row in list(csv.reader(stream))[1:]]
workbook = Workbook()
workbook.active.append(values)
workbook.save('outputs/result.xlsx')
for mode, name in [('w', 'inputs/values.csv'), ('r', sys.argv[1])]:
    try:
        open(name, mode).close()
    except OSError:
        pass
    else:
        raise RuntimeError(f'Unexpected {mode} access to {name}')
try:
    socket.create_connection(('127.0.0.1', int(sys.argv[2])), timeout=2).close()
except OSError:
    pass
else:
    raise RuntimeError('Parent loopback was reachable')
print(values)
`;
  const result = await sandbox.executeCommand('python3', ['-c', code, privateFile, String(listener.address().port)]);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /\[5, 9\]/);
  assert.deepEqual((await readFile(join(output, 'result.xlsx'))).subarray(0, 2), Buffer.from('PK'));
  assert.match(await readFile(join(input, 'values.csv'), 'utf8'), /2,3/);
  console.log('Bubblewrap Python workbook, input write denial, outside read denial and loopback isolation passed.');
} finally {
  await sandbox.stop();
  listener.close();
}
