from pathlib import Path

path = Path('tests/vcpToolBridgeNativeManifest.test.js')
data = path.read_bytes()
nl = b'\r\n' if b'\r\n' in data else b'\n'

anchor1 = b"    const originalReaddir = fs.readdir.bind(fs);" + nl
insert1 = anchor1 + b"    const originalLstat = fs.lstat.bind(fs);" + nl
if data.count(anchor1) != 1:
    raise SystemExit('P1 fixture adapter: originalReaddir anchor mismatch')
data = data.replace(anchor1, insert1, 1)

anchor2 = b"    t.mock.method(fs, 'readFile', async (target, encoding) => {" + nl
lines = [
    b"    t.mock.method(fs, 'lstat', async target => {",
    b"        const resolved = path.resolve(String(target));",
    b"        if (resolved === path.resolve(manifestPath)) {",
    b"            return {",
    b"                isSymbolicLink: () => false,",
    b"                isFile: () => true",
    b"            };",
    b"        }",
    b"        return originalLstat(target);",
    b"    });",
]
insert2 = nl.join(lines) + nl + anchor2
if data.count(anchor2) != 1:
    raise SystemExit('P1 fixture adapter: readFile anchor mismatch')
data = data.replace(anchor2, insert2, 1)
path.write_bytes(data)
