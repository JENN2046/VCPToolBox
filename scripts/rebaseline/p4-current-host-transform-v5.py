#!/usr/bin/env python3
from pathlib import Path

# Execute the current-host transformer, then repair only the two Python-string
# escape sites that must remain literal backslash-n sequences in JS single
# quoted strings. No product semantics are changed here.
source = Path('scripts/rebaseline/p4-current-host-transform-v4.py').read_text(encoding='utf-8')
exec(compile(source, 'p4-current-host-transform-v4.py', 'exec'))

non_path = Path('modules/handlers/nonStreamHandler.js')
non = non_path.read_text(encoding='utf-8')
old_non = "conversationHistoryForClient.push('\n[AGENTSOSResident PROPOSAL_SEQUENCE_REJECTED]\n');"
new_non = "conversationHistoryForClient.push('\\n[AGENTSOSResident PROPOSAL_SEQUENCE_REJECTED]\\n');"
if old_non not in non:
    raise SystemExit('nonstream proposal sequence newline anchor missing')
non_path.write_text(non.replace(old_non, new_non, 1), encoding='utf-8', newline='')

stream_path = Path('modules/handlers/streamHandler.js')
stream = stream_path.read_text(encoding='utf-8')
old_stream = "res.write('data: [DONE]\n\n');"
new_stream = "res.write('data: [DONE]\\n\\n');"
if old_stream not in stream:
    raise SystemExit('stream DONE newline anchor missing')
stream_path.write_text(stream.replace(old_stream, new_stream, 1), encoding='utf-8', newline='')
