'use strict';

// Temporary core binding data for Jenn AI Image native delegate registration.
// Later migration target: Jenn External Ecosystem / Adapter Layer.
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

module.exports = Object.freeze({
  SERUM_BOTTLE_SECRETLESS_DOUBAO_BINDING,
  SERUM_BOTTLE_SECRETLESS_DOUBAO_ALLOWED_COMMANDS,
  SERUM_BOTTLE_SECRETLESS_DOUBAO_RUNTIME_METADATA_DEFAULTS,
});
