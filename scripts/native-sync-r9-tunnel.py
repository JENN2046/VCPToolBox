"""Owned, temporary Cloudflare connector over the existing trusted SSH channel."""
from pathlib import Path
import json, os, re, selectors, signal, subprocess, sys, time
root=Path(sys.argv[1])
assert root.parent==Path('/home/admin/VCPKF/vcp/artifacts/native-sync-r7') and re.fullmatch(r'run-\d+',root.name)
os.umask(0o077)
request=json.loads(sys.stdin.readline());port=request['reversePort'];assert isinstance(port,int) and 1024<=port<=65535
home=root/'public-tunnel';home.mkdir(mode=0o700,exist_ok=True)
config=home/'isolated.yml';config.write_text('no-autoupdate: true\n')
child=subprocess.Popen(['/home/admin/VCPKF/vcp/artifacts/native-sync-r9/tools/cloudflared-2026.10.3','--no-autoupdate','tunnel','--config',str(config),'--url',f'http://127.0.0.1:{port}','--protocol','http2','--edge-ip-version','4','--metrics','127.0.0.1:0'],env={'PATH':'/usr/bin:/bin','HOME':str(home)},stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
def emit(value):print(json.dumps(value),flush=True)
poll=selectors.DefaultSelector();poll.register(child.stdout,selectors.EVENT_READ);poll.register(sys.stdin,selectors.EVENT_READ)
started=time.monotonic();connected=False;origin=None;stopping=False
def stop(*_):
 global stopping
 stopping=True
signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGHUP,stop)
try:
 while not stopping and child.poll() is None and time.monotonic()-started<2700:
  for key,_ in poll.select(.5):
   line=key.fileobj.readline()
   if key.fileobj is sys.stdin:
    if not line or line.strip()=='stop':stopping=True
    continue
   match=re.search(r'https://[a-z0-9-]+\.trycloudflare\.com',line)
   if match and not origin:
    origin=match.group();file=root/'source/config.env';rows=file.read_text().splitlines();assert sum(x.startswith('NativeMobileOrigin=') for x in rows)==1
    file.write_text('\n'.join('NativeMobileOrigin='+origin if x.startswith('NativeMobileOrigin=') else x for x in rows)+'\n')
    emit({'event':'public-origin','origin':origin,'connectorPid':child.pid})
   if 'Registered tunnel connection' in line and not connected:
    connected=True;emit({'event':'public-connected'})
  if not connected and time.monotonic()-started>60:emit({'event':'public-failed','code':'R9_EDGE_CONNECT_TIMEOUT'});break
finally:
 child.terminate()
 try:child.wait(10)
 except subprocess.TimeoutExpired:child.kill();child.wait()
 emit({'event':'public-stopped','connectorPid':child.pid,'exitCode':child.returncode})
