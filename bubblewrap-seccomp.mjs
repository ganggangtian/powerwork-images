import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const [baselinePath, outputPath] = process.argv.slice(2);
if (!baselinePath || !outputPath) throw new Error('Usage: node bubblewrap-seccomp.mjs MOBY_PROFILE OUTPUT_PROFILE');
const bytes = await readFile(baselinePath);
const reviewedBaseline = '3320527d4568265ac97a077609b1bfd4cfd0d789eeb9239b7e094b1526675406';
if (createHash('sha256').update(bytes).digest('hex') !== reviewedBaseline)
  throw new Error('Moby seccomp profile does not match the reviewed baseline.');
const profile = JSON.parse(bytes);
const allow = (names, args = []) => ({ names, action: 'SCMP_ACT_ALLOW', args, includes: { arches: ['amd64', 'arm64'] } });
const matchFlags = (index, value, valueTwo) => ({ index, value, valueTwo, op: 'SCMP_CMP_MASKED_EQ' });
const exact = (index, value) => ({ index, value, op: 'SCMP_CMP_EQ' });
const mount = 0x00020000, uts = 0x04000000, ipc = 0x08000000;
const user = 0x10000000, pid = 0x20000000, network = 0x40000000;
const namespaceFlags = 0x7e020000;
profile.syscalls.push(
  allow(['clone'], [matchFlags(0, namespaceFlags, mount | uts | ipc | user | pid | network)]),
  // The second user namespace removes capabilities before Bubblewrap runs Python.
  allow(['unshare'], [exact(0, user)]),
  // These operations still require the kernel capabilities granted inside the nested user namespace.
  allow(['mount', 'pivot_root']),
  allow(['umount2'], [exact(1, 2)]),
);
await writeFile(outputPath, `${JSON.stringify(profile, null, 2)}\n`, { flag: 'wx' });
