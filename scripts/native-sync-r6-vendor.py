"""Fetch only Cargo.lock-pinned public crates for the isolated Ubuntu build.

Run on Windows when the experiment host cannot reach crates.io. Every archive
must match the lockfile checksum before entering the transferable cache.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import subprocess
import tarfile
import tomllib

source = Path(__file__).resolve().parents[1]
root = source.parent.parent / 'artifacts/native-sync-r6/tools/crates'
root.mkdir(parents=True, exist_ok=True)
packages = [p for p in tomllib.loads((source / 'rust-vexus-lite/Cargo.lock').read_text(encoding='utf-8'))['package'] if p.get('source', '').startswith('registry+')]

def fetch(package):
    assert package['source'] == 'registry+https://github.com/rust-lang/crates.io-index'
    name, version = package['name'], package['version']
    target = root / f'{name}-{version}.crate'
    if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != package['checksum']:
        subprocess.run(['curl.exe', '--fail', '--location', '--retry', '1', '--connect-timeout', '10', '--max-time', '90', '--silent', '--show-error', '--output', str(target), f'https://static.crates.io/crates/{name}/{name}-{version}.crate'], check=True)
    assert hashlib.sha256(target.read_bytes()).hexdigest() == package['checksum'], name
    return {'name': name, 'version': version, 'checksum': package['checksum'], 'archive': target.name}

manifest = []
with ThreadPoolExecutor(max_workers=12) as pool:
    for future in as_completed([pool.submit(fetch, p) for p in packages]):
        manifest.append(future.result())
        if len(manifest) % 40 == 0:
            print(f'Pinned crate checksums verified: {len(manifest)}/{len(packages)}', flush=True)
manifest.sort(key=lambda item: (item['name'], item['version']))
(root / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
bundle = root.parent / 'cargo-crates.tar'
with tarfile.open(bundle, 'w') as archive:
    archive.add(root / 'manifest.json', arcname='manifest.json')
    for item in manifest:
        archive.add(root / item['archive'], arcname=item['archive'])
print(json.dumps({'crates': len(manifest), 'bundle': str(bundle), 'bytes': bundle.stat().st_size, 'allChecksumsVerified': True}), flush=True)
