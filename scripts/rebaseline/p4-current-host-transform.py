#!/usr/bin/env python3
from pathlib import Path
import json
import re
import subprocess

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8', newline='')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, got {count}')
    return text.replace(old, new, 1)


def source_file(ref, path):
    return subprocess.check_output(['git', 'show', f'{ref}:{path}']).decode('utf-8')


# ---------------------------------------------------------------------------
# PR276 current-host adaptation: only the three rejected hunks are handled
# here. All other provider-seal hunks must already have applied via git apply
# --reject before this script runs.
# ---------------------------------------------------------------------------
chat_path = 'modules/chatCompletionHandler.js'
chat = read(chat_path)
source = source_file('5272cbe053dee4fcd6a6ba17bf57db11a30eb958', chat_path)

if "const { createHash, randomBytes } = require('node:crypto');" not in chat:
    chat = replace_once(
        chat,
        "const path = require('path');\n",
        "const path = require('path');\nconst { createHash, randomBytes } = require('node:crypto');\n",
        'chat crypto import'
    )

resident_block_start = source.index("const RESIDENT_PRESENCE_BINDING_PROPERTY")
resident_block_end = source.index("function parseBooleanEnv", resident_block_start)
resident_block = source[resident_block_start:resident_block_end]
if "const RESIDENT_PRESENCE_BINDING_PROPERTY" not in chat:
    chat = replace_once(
        chat,
        "const VCP_TOOL_USE_FORBIDDEN_PLACEHOLDER = '[[VCPToolUse=Forbidden]]';\n\n",
        "const VCP_TOOL_USE_FORBIDDEN_PLACEHOLDER = '[[VCPToolUse=Forbidden]]';\n" + resident_block,
        'chat resident validator block'
    )

if "if (responseCacheKey && !residentPresenceRequested) {\n      finalizeResponseCacheRecorder" not in chat:
    chat = replace_once(
        chat,
        "if (responseCacheKey) {\n      finalizeResponseCacheRecorder = installResponseCacheRecorder",
        "if (responseCacheKey && !residentPresenceRequested) {\n      finalizeResponseCacheRecorder = installResponseCacheRecorder",
        'chat cache recorder guard'
    )
write(chat_path, chat)
rej = ROOT / f'{chat_path}.rej'
if rej.exists():
    rej.unlink()

# ---------------------------------------------------------------------------
# Plugin.js: narrow exact Resident admission + proposal presentation seam.
# ---------------------------------------------------------------------------
plugin_path = 'Plugin.js'
plugin = read(plugin_path)

resident_constants = """const RESIDENT_TOOL_NAME = 'AGENTSOSResident';
const RESIDENT_PROPOSAL_FAILURE_CODES = new Set([
    'RESIDENT_PROPOSAL_DISPATCH_FAILED',
    'RESIDENT_PROPOSAL_EXECUTION_FAILED',
    'RESIDENT_PROPOSAL_INPUT_REJECTED',
    'RESIDENT_PROPOSAL_PREPARE_FAILED',
    'RESIDENT_PROPOSAL_PRESENTATION_FAILED',
    'RESIDENT_PROPOSAL_RESULT_REJECTED'
]);

function residentProposalFailureCode(error) {
    if (RESIDENT_PROPOSAL_FAILURE_CODES.has(error?.code)) return error.code;
    if (error?.code === 'DIRECT_TOOL_TIMEOUT') return 'RESIDENT_PROPOSAL_DISPATCH_FAILED';
    try {
        const parsed = JSON.parse(error?.message || '{}');
        if (RESIDENT_PROPOSAL_FAILURE_CODES.has(parsed?.residentProposalFailure)) {
            return parsed.residentProposalFailure;
        }
        if (RESIDENT_PROPOSAL_FAILURE_CODES.has(parsed?.code)) return parsed.code;
    } catch (_) {}
    return 'RESIDENT_PROPOSAL_EXECUTION_FAILED';
}

"""
if "const RESIDENT_TOOL_NAME = 'AGENTSOSResident';" not in plugin:
    plugin = replace_once(
        plugin,
        "const EXTERNAL_PLUGIN_ALLOWLIST_ENV = 'VCP_EXTERNAL_PLUGIN_ALLOWLIST';\n",
        "const EXTERNAL_PLUGIN_ALLOWLIST_ENV = 'VCP_EXTERNAL_PLUGIN_ALLOWLIST';\n" + resident_constants,
        'plugin resident constants'
    )

method_start = plugin.index('    _evaluateExternalPluginRuntimeRegistration(manifest) {')
method_end = plugin.index('    _warnExternalPluginRegistrationBlocked(decision) {', method_start)
new_registration = """    _isExactAdmittedResidentExternalDirect(manifest, classification, policyDecision, duplicateExisting) {
        return classification?.pluginName === RESIDENT_TOOL_NAME
            && manifest?.pluginType === 'hybridservice'
            && manifest?.communication?.protocol === 'direct'
            && this._hasDirectScriptEntryPoint(manifest)
            && manifest?.requiresAdmin !== true
            && policyDecision?.decision === 'would_allow'
            && classification?.duplicateOfBuiltIn !== true
            && duplicateExisting !== true;
    }

    _evaluateExternalPluginRuntimeRegistration(manifest) {
        if (!this._isExternalPluginManifest(manifest)) {
            return {
                allowed: true,
                decision: 'observe',
                pluginName: manifest?.name || 'unknown',
                pluginSource: manifest?.pluginSource || 'core'
            };
        }

        const classification = classifyExternalPluginManifest(manifest, {
            projectRoot: __dirname,
            isExternal: true,
            builtInPluginNames: Array.from(this.plugins.keys())
        });
        const policyDecision = evaluateExternalPluginAllowPolicy(
            classification,
            this._getExternalPluginRuntimeAllowPolicy(),
            { projectRoot: __dirname }
        );
        const duplicateExisting = Boolean(manifest.name && this.plugins.has(manifest.name));

        if (this._isExternalDirectOrHybridSameProcess(manifest)) {
            const residentAllowed = this._isExactAdmittedResidentExternalDirect(
                manifest,
                classification,
                policyDecision,
                duplicateExisting
            );
            if (residentAllowed) {
                return {
                    allowed: true,
                    decision: 'allowed',
                    code: 'resident_external_direct_runtime_allowed',
                    pluginName: classification.pluginName,
                    pluginSource: 'external',
                    pluginRootId: this._sanitizeExternalRuntimeRootId(manifest.pluginRootId),
                    pluginRootDisplayPath: this._sanitizeExternalRuntimeDisplayPath(manifest.pluginRootDisplayPath),
                    risk: classification.risk,
                    entryPointKind: classification.entryPointKind
                };
            }
            return {
                allowed: false,
                decision: 'blocked',
                code: this._getExternalDirectRuntimeBlockReason(manifest),
                pluginName: classification.pluginName,
                pluginSource: 'external',
                pluginRootId: this._sanitizeExternalRuntimeRootId(manifest.pluginRootId),
                pluginRootDisplayPath: this._sanitizeExternalRuntimeDisplayPath(manifest.pluginRootDisplayPath),
                risk: classification.risk,
                entryPointKind: classification.entryPointKind
            };
        }

        const allowed = policyDecision.decision === 'would_allow'
            && classification.duplicateOfBuiltIn !== true
            && duplicateExisting !== true;

        return {
            allowed,
            decision: allowed ? 'allowed' : 'blocked',
            code: allowed
                ? 'external_runtime_registration_allowed'
                : this._getExternalRegistrationReasonCode(policyDecision, {
                    ...classification,
                    duplicateOfBuiltIn: classification.duplicateOfBuiltIn || duplicateExisting
                }),
            pluginName: classification.pluginName,
            pluginSource: 'external',
            pluginRootId: this._sanitizeExternalRuntimeRootId(manifest.pluginRootId),
            pluginRootDisplayPath: this._sanitizeExternalRuntimeDisplayPath(manifest.pluginRootDisplayPath),
            risk: classification.risk,
            entryPointKind: classification.entryPointKind
        };
    }

"""
plugin = plugin[:method_start] + new_registration + plugin[method_end:]

process_start = plugin.index('    async processToolCall(toolName, toolArgs, requestIp = null, sourceNode = null, executionOptions = {}) {')
process_end = plugin.index('\n    async executePlugin(', process_start)
process = plugin[process_start:process_end]
managed_anchor = """        const managedToolCallRecord = shouldManageToolCallRecord
            ? toolCallRecordStore.beginRecord({ toolName, args: toolArgs || {}, requestIp, sourceNode })
            : null;

"""
if 'const residentProposalCall =' not in process:
    process = replace_once(
        process,
        managed_anchor,
        managed_anchor + """        const residentProposalCall = toolName === RESIDENT_TOOL_NAME
            && typeof toolArgs?.operation === 'string'
            && toolArgs.operation.startsWith('PROPOSE_');

""",
        'plugin resident proposal detection'
    )

old_missing = """        const plugin = this.plugins.get(toolName);
        if (!plugin) {
            const notFoundError = new Error(`[PluginManager] Plugin \"${toolName}\" not found for tool call.`);
            toolCallRecordStore.finishRecord(managedToolCallRecord, {
                success: false,
                result: { plugin_execution_error: notFoundError.message },
                error: notFoundError
            });
            throw notFoundError;
        }
"""
new_missing = """        const plugin = this.plugins.get(toolName);
        if (!plugin) {
            if (residentProposalCall) {
                const fixedCode = 'RESIDENT_PROPOSAL_DISPATCH_FAILED';
                const fixedError = new Error(fixedCode);
                fixedError.code = fixedCode;
                toolCallRecordStore.finishRecord(managedToolCallRecord, {
                    success: false,
                    result: { residentProposalFailure: fixedCode },
                    error: fixedError
                });
                throw fixedError;
            }
            const notFoundError = new Error(`[PluginManager] Plugin \"${toolName}\" not found for tool call.`);
            toolCallRecordStore.finishRecord(managedToolCallRecord, {
                success: false,
                result: { plugin_execution_error: notFoundError.message },
                error: notFoundError
            });
            throw notFoundError;
        }
"""
if old_missing in process:
    process = process.replace(old_missing, new_missing, 1)
elif "residentProposalFailure: fixedCode" not in process:
    raise SystemExit('plugin missing-plugin anchor not found')

direct_anchor = """                const directContext = {
                    requestIp,
                    sourceNode,
                    pluginName: toolName
                };
"""
if "'emitEphemeralPresentation'" not in process:
    process = replace_once(
        process,
        direct_anchor,
        direct_anchor + """                if (
                    residentProposalCall
                    && typeof executionOptions.residentPresentationSink === 'function'
                ) {
                    Object.defineProperty(directContext, 'emitEphemeralPresentation', {
                        configurable: false,
                        enumerable: false,
                        value: executionOptions.residentPresentationSink,
                        writable: false
                    });
                }
""",
        'plugin direct presentation sink'
    )

catch_anchor = """        } catch (e) {
            console.error(`[PluginManager processToolCall] Error during execution for plugin ${toolName}:`, e.message);
"""
if 'Resident proposal failed closed' not in process:
    process = replace_once(
        process,
        catch_anchor,
        """        } catch (e) {
            if (residentProposalCall) {
                const fixedCode = residentProposalFailureCode(e);
                console.error(`[PluginManager processToolCall] Resident proposal failed closed: ${fixedCode}`);
                const fixedResult = { residentProposalFailure: fixedCode };
                toolCallRecordStore.finishRecord(managedToolCallRecord, {
                    success: false,
                    result: fixedResult,
                    error: fixedCode
                });
                const fixedError = new Error(JSON.stringify(fixedResult));
                fixedError.code = fixedCode;
                throw fixedError;
            }
            console.error(`[PluginManager processToolCall] Error during execution for plugin ${toolName}:`, e.message);
""",
        'plugin resident fail closed'
    )
plugin = plugin[:process_start] + process + plugin[process_end:]
write(plugin_path, plugin)

# ---------------------------------------------------------------------------
# ToolExecutor: pass ephemeral sink only for Resident proposal calls and return
# stable failure categories to host framing.
# ---------------------------------------------------------------------------
tool_path = 'modules/vcpLoop/toolExecutor.js'
tool = read(tool_path)
executor_helpers = """const RESIDENT_TOOL_NAME = 'AGENTSOSResident';

function isResidentProposalCall(toolCall) {
  return toolCall?.name === RESIDENT_TOOL_NAME
    && typeof toolCall?.args?.operation === 'string'
    && toolCall.args.operation.startsWith('PROPOSE_');
}

function residentProposalFailureFor(error) {
  const map = {
    RESIDENT_PROPOSAL_DISPATCH_FAILED: 'PROPOSAL_DISPATCH_FAILED',
    RESIDENT_PROPOSAL_EXECUTION_FAILED: 'PROPOSAL_EXECUTION_FAILED',
    RESIDENT_PROPOSAL_INPUT_REJECTED: 'PROPOSAL_INPUT_REJECTED',
    RESIDENT_PROPOSAL_PREPARE_FAILED: 'PROPOSAL_PREPARE_FAILED',
    RESIDENT_PROPOSAL_PRESENTATION_FAILED: 'PROPOSAL_PRESENTATION_FAILED',
    RESIDENT_PROPOSAL_RESULT_REJECTED: 'PROPOSAL_RESULT_REJECTED'
  };
  const candidates = [error?.code];
  try {
    const parsed = JSON.parse(error?.message || '{}');
    candidates.push(parsed?.residentProposalFailure, parsed?.code);
  } catch (_) {}
  for (const candidate of candidates) {
    if (map[candidate]) return map[candidate];
  }
  return 'PROPOSAL_EXECUTION_FAILED';
}

"""
if 'function isResidentProposalCall(toolCall)' not in tool:
    tool = replace_once(
        tool,
        "const VCP_TIMED_CONTACTS_DIR = path.join(__dirname, '..', '..', 'VCPTimedContacts');\n\n",
        "const VCP_TIMED_CONTACTS_DIR = path.join(__dirname, '..', '..', 'VCPTimedContacts');\n" + executor_helpers,
        'tool executor resident helpers'
    )

tool = replace_once(
    tool,
    '  async execute(toolCall, clientIp, contextMessages = []) {\n    const { name, args, river, vref, archeryNoReply } = toolCall;\n',
    """  async execute(toolCall, clientIp, contextMessages = [], requestExecutionContext = {}) {
    const { name, args, river, vref, archeryNoReply } = toolCall;
    const residentProposalCall = isResidentProposalCall(toolCall);
""",
    'tool execute signature'
)

old_not_found = """    if (!this.pluginManager.getPlugin(name)) {
      const message = `未找到名为 \"${name}\" 的插件`;
      const errorResult = this._createErrorResult(name, message);
      toolCallRecordStore.finishRecord(recordHandle, {
        success: false,
        result: errorResult.content,
        error: message
      });
      return this._attachRecordIdToResult(errorResult, recordHandle);
    }
"""
new_not_found = """    if (!this.pluginManager.getPlugin(name)) {
      const message = `未找到名为 \"${name}\" 的插件`;
      const errorResult = this._createErrorResult(name, message);
      if (residentProposalCall) {
        errorResult.residentProposalFailureCategory = 'PROPOSAL_DISPATCH_FAILED';
      }
      toolCallRecordStore.finishRecord(recordHandle, {
        success: false,
        result: errorResult.content,
        error: message
      });
      return this._attachRecordIdToResult(errorResult, recordHandle);
    }
"""
tool = replace_once(tool, old_not_found, new_not_found, 'tool resident missing plugin')

old_call = """      const result = await this.pluginManager.processToolCall(name, args, clientIp, 'post', {
        archeryNoReply: !!archeryNoReply,
        toolCallRecordHandle: recordHandle
      });
"""
new_call = """      const executionOptions = {
        archeryNoReply: !!archeryNoReply,
        toolCallRecordHandle: recordHandle
      };
      if (
        residentProposalCall
        && typeof requestExecutionContext?.residentPresentationSink === 'function'
      ) {
        executionOptions.residentPresentationSink = requestExecutionContext.residentPresentationSink;
      }
      const result = await this.pluginManager.processToolCall(
        name,
        args,
        clientIp,
        'post',
        executionOptions
      );
"""
tool = replace_once(tool, old_call, new_call, 'tool resident execution options')

old_catch = """    } catch (error) {
      const errorResult = this._createErrorResult(name, `执行错误: ${error.message}`);
      toolCallRecordStore.finishRecord(recordHandle, {
        success: false,
        result: errorResult.content,
        error
      });
      return this._attachRecordIdToResult(errorResult, recordHandle);
    }
"""
new_catch = """    } catch (error) {
      const errorResult = this._createErrorResult(name, `执行错误: ${error.message}`);
      if (residentProposalCall) {
        errorResult.residentProposalFailureCategory = residentProposalFailureFor(error);
      }
      toolCallRecordStore.finishRecord(recordHandle, {
        success: false,
        result: errorResult.content,
        error
      });
      return this._attachRecordIdToResult(errorResult, recordHandle);
    }
"""
tool = replace_once(tool, old_catch, new_catch, 'tool resident catch')

tool = replace_once(
    tool,
    """  async executeAll(toolCalls, clientIp, contextMessages = []) {
    return Promise.all(
      toolCalls.map(tc => this.execute(tc, clientIp, contextMessages))
    );
  }
""",
    """  async executeAll(toolCalls, clientIp, contextMessages = [], requestExecutionContext = {}) {
    return Promise.all(
      toolCalls.map(tc => this.execute(tc, clientIp, contextMessages, requestExecutionContext))
    );
  }
""",
    'tool executeAll context'
)
write(tool_path, tool)

# ---------------------------------------------------------------------------
# Non-stream host framing.
# ---------------------------------------------------------------------------
non_path = 'modules/handlers/nonStreamHandler.js'
non = read(non_path)
resident_require = """const {
  attachNonStreamPresentations,
  createNonStreamPresentationSink,
  createPresentationChannel,
  frameResidentProposalTurn,
  hasResidentProposalSurface,
  isResidentProposalToolCall,
  residentProposalFailureCategory
} = require('../vcpLoop/residentPresentation.js');
"""
if "require('../vcpLoop/residentPresentation.js')" not in non:
    non = replace_once(
        non,
        "const roleDivider = require('../roleDivider.js');\n",
        "const roleDivider = require('../roleDivider.js');\n" + resident_require,
        'nonstream resident import'
    )

setup_anchor = '    const shouldShowVCP = SHOW_VCP_OUTPUT || this.context.forceShowVCP;\n'
if 'residentPresentations = []' not in non:
    non = replace_once(
        non,
        setup_anchor,
        setup_anchor + """    const residentProposalFramingActive = hasResidentProposalSurface(originalBody.messages);
    const residentPresentations = [];
    const residentPresentationChannel = createPresentationChannel(res, residentProposalFramingActive);
    const residentPresentationSink = residentProposalFramingActive
      ? createNonStreamPresentationSink({
        channelId: residentPresentationChannel,
        presentations: residentPresentations,
        res
      })
      : null;
    let residentProposalExecuted = false;
""",
        'nonstream resident setup'
    )

loop_anchor = """      let anyToolProcessedInCurrentIteration = false;
      conversationHistoryForClient.push(currentAIContentForClient);

      const toolCalls = vcpToolUseForbidden ? [] : ToolCallParser.parse(currentAIContentForLoop);
"""
loop_replacement = """      let anyToolProcessedInCurrentIteration = false;
      const residentFrame = residentProposalFramingActive
        ? frameResidentProposalTurn(currentAIContentForLoop, ToolCallParser)
        : { kind: 'NONE', clientContent: currentAIContentForClient, loopContent: currentAIContentForLoop };
      if (residentFrame.kind !== 'NONE') res.__vcpDisableReplayCache?.();
      if (
        residentFrame.kind === 'INVALID'
        || (residentFrame.kind === 'RESIDENT_PROPOSAL' && residentProposalExecuted)
      ) {
        if (residentFrame.clientContent) conversationHistoryForClient.push(residentFrame.clientContent);
        conversationHistoryForClient.push('\n[AGENTSOSResident PROPOSAL_SEQUENCE_REJECTED]\n');
        break;
      }
      if (residentFrame.kind === 'RESIDENT_PROPOSAL') {
        currentAIContentForLoop = residentFrame.loopContent;
        currentAIContentForClient = residentFrame.clientContent;
      }
      conversationHistoryForClient.push(currentAIContentForClient);

      const toolCalls = vcpToolUseForbidden ? [] : ToolCallParser.parse(currentAIContentForLoop);
      const residentProposalCalls = toolCalls.filter(isResidentProposalToolCall);
"""
non = replace_once(non, loop_anchor, loop_replacement, 'nonstream proposal framing')

old_execute_all = '        const toolResults = await toolExecutor.executeAll(normalCalls, clientIp, currentMessagesForNonStreamLoop);\n'
new_execute_all = """        if (residentProposalCalls.length > 0) residentProposalExecuted = true;
        const toolResults = await toolExecutor.executeAll(
          normalCalls,
          clientIp,
          currentMessagesForNonStreamLoop,
          { residentPresentationSink }
        );
        if (residentProposalCalls.length === 1) {
          const proposalIndex = normalCalls.findIndex(isResidentProposalToolCall);
          const proposalFailure = proposalIndex >= 0
            ? residentProposalFailureCategory(toolResults[proposalIndex])
            : 'PROPOSAL_DISPATCH_FAILED';
          if (proposalFailure) {
            conversationHistoryForClient.push(`\n[AGENTSOSResident ${proposalFailure}]\n`);
            break;
          }
        }
"""
non = replace_once(non, old_execute_all, new_execute_all, 'nonstream proposal execution')

send_anchor = """    if (writeChatLog) writeChatLog(originalBody, chatLogs);
    recordOneRingAIResponse(oneRingAssistantTurnParts.join('\n'), 'final_turn');
    if (!res.writableEnded && !res.destroyed) {
      res.send(Buffer.from(JSON.stringify(finalJsonResponse)));
    }
"""
send_replacement = """    attachNonStreamPresentations(finalJsonResponse, residentPresentations);
    if (writeChatLog) writeChatLog(originalBody, chatLogs);
    recordOneRingAIResponse(oneRingAssistantTurnParts.join('\n'), 'final_turn');
    if (!res.writableEnded && !res.destroyed) {
      res.send(Buffer.from(JSON.stringify(finalJsonResponse)));
    }
"""
non = replace_once(non, send_anchor, send_replacement, 'nonstream attach presentations')
write(non_path, non)

# ---------------------------------------------------------------------------
# Stream host framing. Provider chunks are deferred only when a Resident tool
# surface is present. Keepalive comments remain direct; proposal payload chunks
# are discarded and only the host-safe client prefix is emitted.
# ---------------------------------------------------------------------------
stream_path = 'modules/handlers/streamHandler.js'
stream = read(stream_path)
stream_require = """const {
  createPresentationChannel,
  createStreamPresentationSink,
  frameResidentProposalTurn,
  hasResidentProposalSurface,
  isResidentProposalToolCall,
  residentProposalFailureCategory
} = require('../vcpLoop/residentPresentation.js');
"""
if "require('../vcpLoop/residentPresentation.js')" not in stream:
    stream = replace_once(
        stream,
        "} = require('../reasoningContentAdapter.js');\n",
        "} = require('../reasoningContentAdapter.js');\n" + stream_require,
        'stream resident import'
    )

stream_setup_anchor = '    const id = originalBody.requestId || originalBody.messageId;\n'
if 'residentProposalFramingActive = hasResidentProposalSurface' not in stream:
    stream = replace_once(
        stream,
        stream_setup_anchor,
        stream_setup_anchor + """    const residentProposalFramingActive = hasResidentProposalSurface(originalBody.messages);
    const residentPresentationChannel = createPresentationChannel(res, residentProposalFramingActive);
    const residentPresentationSink = residentProposalFramingActive
      ? createStreamPresentationSink({
        channelId: residentPresentationChannel,
        model: originalBody.model,
        res
      })
      : null;
    let residentProposalExecuted = false;
    const failResidentProposalStream = (code) => {
      res.__vcpDisableReplayCache?.();
      if (!res.writableEnded && !res.destroyed) {
        const payload = {
          id: `chatcmpl-resident-fail-${Date.now()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: originalBody.model || 'unknown',
          choices: [{ index: 0, delta: { content: `\n[AGENTSOSResident ${code}]\n` }, finish_reason: 'stop' }]
        };
        try {
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } catch (_) {}
      }
    };
""",
        'stream resident setup'
    )

helper_start = stream.index('    const processAIResponseStreamHelper = async (aiResponse, isInitialCall) => {')
helper_end = stream.index('\n    // --- 初始 AI 调用 ---', helper_start)
helper = stream[helper_start:helper_end]
if 'deferredClientWrites' not in helper:
    helper = helper.replace('res.write(', 'writeProviderClientChunk(')
    state_anchor = '        let clientReasoningEndsWithNewline = false;\n'
    helper_support = """        let deferredClientWrites = [];
        const writeProviderClientChunk = (chunk, encodingOrCallback, maybeCallback) => {
          const keepalive = typeof chunk === 'string' && chunk.startsWith(': vcp-keepalive');
          if (!residentProposalFramingActive || keepalive) {
            return res.write(chunk, encodingOrCallback, maybeCallback);
          }
          deferredClientWrites.push({ chunk, encodingOrCallback, maybeCallback });
          const callback = typeof encodingOrCallback === 'function'
            ? encodingOrCallback
            : (typeof maybeCallback === 'function' ? maybeCallback : null);
          if (callback) queueMicrotask(() => callback());
          return true;
        };
        const flushDeferredClientWrites = () => {
          for (const item of deferredClientWrites) {
            if (res.writableEnded || res.destroyed) break;
            res.write(item.chunk);
          }
          deferredClientWrites = [];
        };
        const discardDeferredClientWrites = () => { deferredClientWrites = []; };
        const invalidResidentFrame = Object.freeze({
          clientContent: '',
          kind: 'INVALID',
          loopContent: '',
          toolCalls: Object.freeze([])
        });
        const incompleteStreamResult = () => {
          if (residentProposalFramingActive) {
            res.__vcpDisableReplayCache?.();
            discardDeferredClientWrites();
            return { content: '', message, residentFrame: invalidResidentFrame };
          }
          return { content: collectedContentThisTurn, message };
        };
        const writeResidentClientPrefix = (content) => {
          if (!content || res.writableEnded || res.destroyed) return;
          const payload = {
            id: `chatcmpl-resident-client-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: originalBody.model || 'unknown',
            choices: [{ index: 0, delta: { content }, finish_reason: null }]
          };
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        };
"""
    helper = replace_once(helper, state_anchor, state_anchor + helper_support, 'stream deferred support')

    # The first two identical resolves are idle-timeout and abort paths.
    incomplete_old = '            resolve({ content: collectedContentThisTurn, message: message });'
    if helper.count(incomplete_old) < 2:
        raise SystemExit('stream incomplete resolve anchors missing')
    helper = helper.replace(incomplete_old, '            resolve(incompleteStreamResult());', 2)

    error_old = '            resolve({ content: collectedContentThisTurn, raw: rawResponseDataThisTurn, message: message });'
    if error_old in helper:
        helper = helper.replace(
            error_old,
            """            if (residentProposalFramingActive) {
              resolve(incompleteStreamResult());
            } else {
              resolve({ content: collectedContentThisTurn, raw: rawResponseDataThisTurn, message: message });
            }""",
            1
        )

    normal_end = """          writeClientReasoningCloseChunk();
          if (abortController?.signal) abortController.signal.removeEventListener('abort', abortHandler);
          resolve({ content: collectedContentThisTurn, message: message });
"""
    normal_replacement = """          writeClientReasoningCloseChunk();
          if (abortController?.signal) abortController.signal.removeEventListener('abort', abortHandler);
          let residentFrame = null;
          let finalLoopContent = collectedContentThisTurn;
          if (residentProposalFramingActive) {
            res.__vcpDisableReplayCache?.();
            residentFrame = frameResidentProposalTurn(collectedContentThisTurn, ToolCallParser);
            if (residentFrame.kind === 'NONE') {
              flushDeferredClientWrites();
            } else if (residentFrame.kind === 'RESIDENT_PROPOSAL') {
              discardDeferredClientWrites();
              writeResidentClientPrefix(residentFrame.clientContent);
              finalLoopContent = residentFrame.loopContent;
            } else {
              discardDeferredClientWrites();
              finalLoopContent = '';
            }
          }
          resolve({ content: finalLoopContent, message: message, residentFrame });
"""
    helper = replace_once(helper, normal_end, normal_replacement, 'stream normal frame finalization')

stream = stream[:helper_start] + helper + stream[helper_end:]

initial_anchor = """    let initialAIResponseData = await processAIResponseStreamHelper(firstAiAPIResponse, true);
    currentAIContentForLoop = initialAIResponseData.content;
"""
initial_replacement = """    let initialAIResponseData = await processAIResponseStreamHelper(firstAiAPIResponse, true);
    let currentResidentFrame = initialAIResponseData.residentFrame || null;
    if (currentResidentFrame?.kind === 'INVALID') {
      failResidentProposalStream('PROPOSAL_SEQUENCE_REJECTED');
      return;
    }
    currentAIContentForLoop = initialAIResponseData.content;
"""
stream = replace_once(stream, initial_anchor, initial_replacement, 'stream initial frame')

parse_anchor = """      const toolCalls = vcpToolUseForbidden ? [] : ToolCallParser.parse(currentAIContentForLoop);
      if (toolCalls.length === 0) {
"""
parse_replacement = """      const toolCalls = vcpToolUseForbidden ? [] : ToolCallParser.parse(currentAIContentForLoop);
      const residentProposalCalls = toolCalls.filter(isResidentProposalToolCall);
      if (
        currentResidentFrame?.kind === 'RESIDENT_PROPOSAL'
        && (residentProposalCalls.length !== 1 || residentProposalExecuted)
      ) {
        failResidentProposalStream('PROPOSAL_SEQUENCE_REJECTED');
        return;
      }
      if (toolCalls.length === 0) {
"""
stream = replace_once(stream, parse_anchor, parse_replacement, 'stream proposal parse gate')

old_stream_execute = '      const toolResults = await toolExecutor.executeAll(normalCalls, clientIp, currentMessagesForLoop);\n'
new_stream_execute = """      if (residentProposalCalls.length > 0) residentProposalExecuted = true;
      const toolResults = await toolExecutor.executeAll(
        normalCalls,
        clientIp,
        currentMessagesForLoop,
        { residentPresentationSink }
      );
      if (residentProposalCalls.length === 1) {
        const proposalIndex = normalCalls.findIndex(isResidentProposalToolCall);
        const proposalFailure = proposalIndex >= 0
          ? residentProposalFailureCategory(toolResults[proposalIndex])
          : 'PROPOSAL_DISPATCH_FAILED';
        if (proposalFailure) {
          failResidentProposalStream(proposalFailure);
          return;
        }
      }
"""
stream = replace_once(stream, old_stream_execute, new_stream_execute, 'stream proposal execution')

next_anchor = """          let nextAIResponseData = await processAIResponseStreamHelper(nextAiAPIResponse, false);
          currentAIContentForLoop = nextAIResponseData.content;
"""
next_replacement = """          let nextAIResponseData = await processAIResponseStreamHelper(nextAiAPIResponse, false);
          currentResidentFrame = nextAIResponseData.residentFrame || null;
          if (currentResidentFrame?.kind === 'INVALID') {
            failResidentProposalStream('PROPOSAL_SEQUENCE_REJECTED');
            return;
          }
          currentAIContentForLoop = nextAIResponseData.content;
"""
if next_anchor in stream:
    stream = stream.replace(next_anchor, next_replacement)
else:
    raise SystemExit('stream next response anchors missing')
write(stream_path, stream)

# ---------------------------------------------------------------------------
# Focused P4 host contract tests.
# ---------------------------------------------------------------------------
test_path = ROOT / 'tests/residentHostContract.test.cjs'
test_path.write_text(r'''\
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const resident = require('../modules/vcpLoop/residentPresentation.js');

function validPresentation() {
  return {
    challenge: '确认变更，山、河、星',
    expiresInSeconds: 90,
    kind: 'OWNER_CONSENT_CHALLENGE',
    mutationType: 'START_TASK',
    schema: 'agents-os-resident.host-presentation.v1',
    title: 'AGENTSOSResident · Owner Consent'
  };
}

test('Resident host presentation accepts only exact bounded challenge envelopes', () => {
  const accepted = resident.validateHostPresentation(validPresentation());
  assert.equal(accepted.challenge, '确认变更，山、河、星');
  assert.throws(() => resident.validateHostPresentation({ ...validPresentation(), extra: true }));
  assert.throws(() => resident.validateHostPresentation({ ...validPresentation(), challenge: 'wrong' }));
});

test('Resident proposal framer hides proposal tool block from client content', () => {
  const parsed = { name: 'AGENTSOSResident', archery: false, args: { operation: 'PROPOSE_TASK_MUTATION' } };
  const parser = {
    MARKERS: { START: '[[START]]' },
    parse() { return [parsed]; },
    extractNextToolBlock(content, offset) {
      if (offset > 0) return null;
      return { startIndex: 7, nextOffset: content.length, blockContent: 'resident-proposal' };
    },
    parseBlock() { return parsed; }
  };
  const framed = resident.frameResidentProposalTurn('visible[[START]]private-payload', parser);
  assert.equal(framed.kind, 'RESIDENT_PROPOSAL');
  assert.equal(framed.clientContent, 'visible');
  assert.equal(framed.loopContent, 'visible[[START]]private-payload');
});

test('Resident presentation sinks are host-only and disable replay cache', async () => {
  class FakeResponse extends EventEmitter {
    constructor() {
      super();
      this.headersSent = false;
      this.writableEnded = false;
      this.destroyed = false;
      this.headers = {};
      this.writes = [];
      this.cacheDisabled = false;
    }
    setHeader(k, v) { this.headers[k] = v; }
    write(chunk, cb) { this.writes.push(String(chunk)); if (cb) cb(); return true; }
    __vcpDisableReplayCache() { this.cacheDisabled = true; }
  }
  const res = new FakeResponse();
  const channelId = resident.createPresentationChannel(res, true);
  const streamSink = resident.createStreamPresentationSink({ channelId, model: 'test', res });
  await streamSink(validPresentation());
  assert.equal(res.cacheDisabled, true);
  assert.match(res.writes.join(''), /vcp_ephemeral_presentation/);

  const list = [];
  const res2 = new FakeResponse();
  const channel2 = resident.createPresentationChannel(res2, true);
  const nonStreamSink = resident.createNonStreamPresentationSink({ channelId: channel2, presentations: list, res: res2 });
  await nonStreamSink(validPresentation());
  const response = {};
  resident.attachNonStreamPresentations(response, list);
  assert.equal(response.vcp_ephemeral_presentations.length, 1);
  assert.equal(res2.cacheDisabled, true);
});

test('P4 keeps exact Resident admission narrow and all other external direct plugins fail closed', () => {
  const plugin = fs.readFileSync('Plugin.js', 'utf8');
  assert.match(plugin, /classification\?\.pluginName === RESIDENT_TOOL_NAME/);
  assert.match(plugin, /policyDecision\?\.decision === 'would_allow'/);
  assert.match(plugin, /code: 'resident_external_direct_runtime_allowed'/);
  assert.match(plugin, /external_hybrid_runtime_denied/);
  assert.match(plugin, /external_direct_runtime_denied/);
  assert.match(plugin, /Object\.defineProperty\(directContext, 'emitEphemeralPresentation'/);
});

test('P4 host seams pass proposal presentation without serializing it as ordinary tool content', () => {
  const tool = fs.readFileSync('modules/vcpLoop/toolExecutor.js', 'utf8');
  const non = fs.readFileSync('modules/handlers/nonStreamHandler.js', 'utf8');
  const stream = fs.readFileSync('modules/handlers/streamHandler.js', 'utf8');
  assert.match(tool, /residentPresentationSink/);
  assert.match(tool, /residentProposalFailureCategory/);
  assert.match(non, /frameResidentProposalTurn/);
  assert.match(non, /attachNonStreamPresentations/);
  assert.match(stream, /deferredClientWrites/);
  assert.match(stream, /frameResidentProposalTurn/);
  assert.match(stream, /discardDeferredClientWrites/);
});

test('P4 provider path retains exact-body seal and fail-closed presence binding', () => {
  const handler = fs.readFileSync('modules/chatCompletionHandler.js', 'utf8');
  assert.match(handler, /RESIDENT_PROVIDER_ATTEMPT_DENIED/);
  assert.match(handler, /result\.body === input\.finalBodyText/);
  assert.match(handler, /sealProviderAttempt/);
  assert.match(handler, /providerAttemptNamespace/);
  assert.match(handler, /!residentPresenceRequested[\s\S]{0,160}responseReplayCache\.replay/);
});
''', encoding='utf-8')

print('P4 current-host transform complete')
