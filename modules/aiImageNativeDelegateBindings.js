'use strict';

// Core adapter binding data for AI Image native delegate registration.
// Later migration target: external AI Image adapter layer.
// This module must stay side-effect-free: no IO, env reads, routes, services, or execution dispatch.

const SERUM_BOTTLE_SECRETLESS_DOUBAO_ALLOWED_COMMANDS = Object.freeze([
  'generate',
  'edit',
  'compose',
  'group',
]);

const SERUM_BOTTLE_SECRETLESS_DOUBAO_BINDING = Object.freeze({
  delegateId: 'serum_bottle_secretless_doubao_v1',
  providerId: 'doubao',
  pluginId: 'DoubaoGen',
  apiId: 'generate_image',
  internalCommand: 'generate',
  allowedCommands: SERUM_BOTTLE_SECRETLESS_DOUBAO_ALLOWED_COMMANDS,
});

const SERUM_BOTTLE_SECRETLESS_DOUBAO_RUNTIME_METADATA_DEFAULTS = Object.freeze({
  requestSource: 'agent-image-lab-secretless-runtime',
  bridgeId: 'native_doubao_secretless_runtime_delegate',
  providerBindingRefRedacted: true,
});

const AI_IMAGE_NATIVE_DELEGATE_BINDINGS = Object.freeze({
  serumBottleSecretlessDoubao: SERUM_BOTTLE_SECRETLESS_DOUBAO_BINDING,
});

const AI_IMAGE_NATIVE_DELEGATE_RUNTIME_METADATA_DEFAULTS = Object.freeze({
  serumBottleSecretlessDoubao: SERUM_BOTTLE_SECRETLESS_DOUBAO_RUNTIME_METADATA_DEFAULTS,
});

module.exports = Object.freeze({
  AI_IMAGE_NATIVE_DELEGATE_BINDINGS,
  AI_IMAGE_NATIVE_DELEGATE_RUNTIME_METADATA_DEFAULTS,
  SERUM_BOTTLE_SECRETLESS_DOUBAO_BINDING,
  SERUM_BOTTLE_SECRETLESS_DOUBAO_ALLOWED_COMMANDS,
  SERUM_BOTTLE_SECRETLESS_DOUBAO_RUNTIME_METADATA_DEFAULTS,
});
