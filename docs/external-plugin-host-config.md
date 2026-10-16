# Host configuration for a registered external plugin

External roots still ignore plugin `config.env` and do not inherit global plugin
settings. The existing explicit name/source runtime allowlist remains required.
The host may additionally set `VCP_EXTERNAL_PLUGIN_CONFIG_FILE` to an absolute
path to its own JSON file (maximum 64 KiB). Keep this file outside external plugin
repositories and restrict filesystem access as for the host's other credentials.
No file is selected by default; no plugin registration or permission is granted
by this file.

```json
{
  "bindings": [{
    "pluginName": "JennShootingOperations",
    "sourceDirectory": "/absolute/isolated/extensions/Plugin",
    "config": {
      "JSO_LOCAL_AGENT_ENDPOINT": "http://127.0.0.1:46063/api/v2/agent/tools",
      "JSO_RESOURCE_IDS": "SYNTHETIC-RESOURCE",
      "JSO_CALL_POLICY": "native-direct-and-confirm",
      "JSO_MAX_SHIFT_MINUTES": 1,
      "JSO_JOURNAL_PATH": "/absolute/isolated/journal",
      "JSO_ASSISTANT_SUBJECT_ID": "synthetic-agent",
      "JSO_DEFAULT_RESOURCE_ID": "SYNTHETIC-RESOURCE"
    }
  }]
}
```

Add the existing synthetic `JSO_LOCAL_AGENT_TOKEN` fixture only in the local test
file; the example deliberately contains no credential. Source directory matches
the registered external root by canonical filesystem path, not the plugin's leaf
directory. Each binding is for one exact name and source; no wildcards, environment
expansion or global secret lookup. Only explicitly supplied, manifest-declared
string, integer or boolean fields are accepted; invalid files fail closed with a
fixed error code. Configuration is read on use; replace the file atomically.

The existing external child-process environment policy still removes sensitive
fields. For JSO the native broker retains the assistant token in the host and
sends only its existing temporary invocation context to stdio. This does not add
application authorization or change native confirmation rules. To revoke this
configuration, remove the binding or unset the host file setting; the registered
external plugin then receives no configuration. Do not reclassify it as core.
