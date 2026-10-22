"""Read-only preparation against the real host; never installs or restarts."""
from pathlib import Path
import base64
import difflib
import hashlib
import json
import re
import subprocess

root = Path('/app/VCPToolBox')
raw = (root / 'server.js').read_bytes()
source = raw.decode('utf-8')
assert "app.use('/mobile'" not in source and 'setExecutionEndpoint' not in source
anchor = 'const app = express();'
assert source.count(anchor) == 1
patched = source.replace(anchor, anchor + '''
// NativeSync mobile capability routes authenticate before the global Key gate.
app.use('/mobile', (req, res) => {
    const plugin = pluginManager.getServiceModule('NativeSync');
    if (!plugin?.handleMobile) return res.status(503).json({error:{code:'MOBILE_DISABLED'}});
    return plugin.handleMobile(req, res);
});''')
matches = list(re.finditer(r'server\s*=\s*app\.listen\([^\n]*=>\s*\{', patched))
assert len(matches) == 1
position = matches[0].end()
patched = patched[:position] + '''
        pluginManager.getServiceModule('NativeSync')?.setExecutionEndpoint?.({url:`http://127.0.0.1:${server.address().port}/v1/chat/completions`,key:serverKey});''' + patched[position:]
anchor = 'serverLifecycleState = SERVER_LIFECYCLE.DRAINING;'
assert patched.count(anchor) == 1
patched = patched.replace(anchor, anchor + "\n    pluginManager.getServiceModule('NativeSync')?.beginDrain?.();")
if b'\r\n' in raw:
    patched = patched.replace('\r\n', '\n').replace('\n', '\r\n')
patch = ''.join(difflib.unified_diff(source.splitlines(keepends=True), patched.splitlines(keepends=True), fromfile='a/server.js', tofile='b/server.js'))
check = subprocess.run(['git', 'apply', '--check', '-'], input=patch.encode(), cwd=root, capture_output=True)
print(json.dumps({
    'result': 'PATCH_DRY_RUN_PASS' if check.returncode == 0 else 'PATCH_DRY_RUN_FAIL',
    'sourceRoot': str(root), 'productionModified': False,
    'sourceSha256': hashlib.sha256(raw).hexdigest(),
    'patchedSha256': hashlib.sha256(patched.encode()).hexdigest(),
    'patchSha256': hashlib.sha256(patch.encode()).hexdigest(),
    'hunks': patch.count('@@') // 2,
    'patchBase64': base64.b64encode(patch.encode()).decode(),
    'dryRunExit': check.returncode,
    'diagnostic': check.stderr.decode()[:300]
}))
