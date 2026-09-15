#!/usr/bin/env python3
from pathlib import Path

base = Path('scripts/rebaseline/p4-current-host-transform.py').read_text(encoding='utf-8')

start = base.index("send_anchor = ")
end = base.index("write(non_path, non)", start)
nonstream_replacement = r'''send_marker = "    if (writeChatLog) writeChatLog(originalBody, chatLogs);\n"
if 'attachNonStreamPresentations(finalJsonResponse, residentPresentations);' not in non:
    marker_index = non.index(send_marker)
    non = (
        non[:marker_index]
        + "    attachNonStreamPresentations(finalJsonResponse, residentPresentations);\n"
        + non[marker_index:]
    )
'''
patched = base[:start] + nonstream_replacement + base[end:]

old_block = r'''    # The first two identical resolves are idle-timeout and abort paths.
    incomplete_old = '            resolve({ content: collectedContentThisTurn, message: message });'
    if helper.count(incomplete_old) < 2:
        raise SystemExit('stream incomplete resolve anchors missing')
    helper = helper.replace(incomplete_old, '            resolve(incompleteStreamResult());', 2)
'''
new_block = r'''    # The first two semantic matches are idle-timeout and abort paths.
    incomplete_pattern = re.compile(
        r"resolve\(\{\s*content:\s*collectedContentThisTurn,\s*message:\s*message\s*\}\);"
    )
    helper, incomplete_count = incomplete_pattern.subn(
        'resolve(incompleteStreamResult());',
        helper,
        count=2
    )
    if incomplete_count != 2:
        raise SystemExit(f'stream incomplete resolve anchors missing: {incomplete_count}')
'''
if old_block not in patched:
    raise SystemExit('v4 generator could not find incomplete stream transform block')
patched = patched.replace(old_block, new_block, 1)

exec(compile(patched, 'p4-current-host-transform-v4.generated.py', 'exec'))
