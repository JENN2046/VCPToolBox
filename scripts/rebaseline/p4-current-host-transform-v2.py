#!/usr/bin/env python3
from pathlib import Path

base = Path('scripts/rebaseline/p4-current-host-transform.py').read_text(encoding='utf-8')
start = base.index("send_anchor = ")
end_marker = "write(non_path, non)"
end = base.index(end_marker, start)
replacement = r'''send_marker = "    if (writeChatLog) writeChatLog(originalBody, chatLogs);\n"
if 'attachNonStreamPresentations(finalJsonResponse, residentPresentations);' not in non:
    marker_index = non.index(send_marker)
    non = (
        non[:marker_index]
        + "    attachNonStreamPresentations(finalJsonResponse, residentPresentations);\n"
        + non[marker_index:]
    )
'''
patched = base[:start] + replacement + base[end:]
exec(compile(patched, 'p4-current-host-transform-v2.generated.py', 'exec'))
