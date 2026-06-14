'use strict';

// Core adapter fixture data for AI Image trial bindings.
// Later migration target: external AI Image adapter package.
// This module must stay side-effect-free: no IO, env reads, routes, services, or execution dispatch.

const SERUM_BOTTLE_SECRETLESS_MODE = 'serum_bottle_secretless_internal_execute';
const R2R_V2_TRIAL_001_SECRETLESS_MODE =
  'r2r_v2_trial_001_serum_detail_control_secretless_internal_execute';
const R2R_V2_TRIAL_002_SECRETLESS_MODE =
  'r2r_v2_trial_002_lantern_ecommerce_hero_secretless_internal_execute';

const SERUM_BOTTLE_SECRETLESS_EXACT_ACTIVATION_ID =
  'AUTH-SECRETLESS-SERUM-LIVE-PROBE-20260603-018';
const SERUM_BOTTLE_SECRETLESS_EXACT_PIPELINE_ID =
  'secretless-serum-live-probe-attempt-018';
const SERUM_BOTTLE_SECRETLESS_EXACT_RECEIPT_REF =
  'reports/runtime_to_review_v1/secretless_serum_live_probe_receipt_20260603_attempt_018.json';
const SERUM_BOTTLE_SECRETLESS_EXACT_ARTIFACT_RECORD_REF =
  'reports/runtime_to_review_v1/secretless_serum_live_probe_artifact_record_20260603_attempt_018.json';
const SERUM_BOTTLE_SECRETLESS_EXACT_OUTPUT_DIRECTORY_REF =
  'runs/real_generation/runtime_to_review_v1_guarded_live_probe_serum_bottle_secretless_attempt_018/';

const R2R_V2_TRIAL_001_EXACT_ACTIVATION_ID =
  'AUTH-R2R-V2-TRIAL-001-SERUM-DETAIL-CONTROL-20260608-FUTURE-EXECUTION';
const R2R_V2_TRIAL_001_EXACT_PIPELINE_ID =
  'runtime_to_review_v2_trial_001_serum_detail_control';
const R2R_V2_TRIAL_001_EXACT_PROMPT_PACKAGE_REF =
  'prompts/image_generation/product_detail_premium_serum_bottle_v2.yaml';
const R2R_V2_TRIAL_001_EXACT_RECEIPT_REF =
  'reports/runtime_to_review_v2/r2r_v2_trial_001_serum_detail_control_receipt.json';
const R2R_V2_TRIAL_001_EXACT_ARTIFACT_RECORD_REF =
  'reports/runtime_to_review_v2/r2r_v2_trial_001_serum_detail_control_artifact_record.json';
const R2R_V2_TRIAL_001_EXACT_REVIEW_BRIDGE_REF =
  'review_console/live_receipt_bridge/r2r_v2_trial_001_serum_detail_control/bridge_entry.json';
const R2R_V2_TRIAL_001_EXACT_OUTPUT_DIRECTORY_REF =
  'runs/real_generation/runtime_to_review_v2_trial_001_serum_detail_control/';
const R2R_V2_TRIAL_001_ROUTE_ID =
  'r2r_v2_trial_001_serum_detail_control_secretless';

const R2R_V2_TRIAL_002_EXACT_ACTIVATION_ID =
  'AUTH-R2R-V2-TRIAL-002-LANTERN-ECOMMERCE-HERO-20260609-BINDING-READY';
const R2R_V2_TRIAL_002_EXACT_PIPELINE_ID =
  'runtime_to_review_v2_trial_002_lantern_ecommerce_hero';
const R2R_V2_TRIAL_002_EXACT_PROMPT_PACKAGE_REF =
  'prompts/image_generation/product_lifestyle_premium_portable_led_camping_lantern_v2.yaml';
const R2R_V2_TRIAL_002_EXACT_RECEIPT_REF =
  'reports/runtime_to_review_v2/r2r_v2_trial_002_lantern_ecommerce_hero_receipt.json';
const R2R_V2_TRIAL_002_EXACT_ARTIFACT_RECORD_REF =
  'reports/runtime_to_review_v2/r2r_v2_trial_002_lantern_ecommerce_hero_artifact_record.json';
const R2R_V2_TRIAL_002_EXACT_REVIEW_BRIDGE_REF =
  'review_console/live_receipt_bridge/r2r_v2_trial_002_lantern_ecommerce_hero/bridge_entry.json';
const R2R_V2_TRIAL_002_EXACT_OUTPUT_DIRECTORY_REF =
  'runs/real_generation/runtime_to_review_v2_trial_002_lantern_ecommerce_hero/';
const R2R_V2_TRIAL_002_ROUTE_ID =
  'r2r_v2_trial_002_lantern_ecommerce_hero_secretless';
const R2R_V2_TRIAL_002_EXACT_DOUBAO_PROJECT_BASE_PATH_OVERRIDE =
  'A:\\agent-image-lab\\agent-image-lab-v0.2\\runs\\real_generation\\runtime_to_review_v2_trial_002_lantern_ecommerce_hero';

const SERUM_BOTTLE_SECRETLESS_OUTPUT_REF_PREFIX =
  'runs/real_generation/runtime_to_review_v1_guarded_live_probe_serum_bottle_secretless_attempt_';
const R2R_V2_TRIAL_001_OUTPUT_REF_PREFIX =
  'runs/real_generation/runtime_to_review_v2_trial_001_serum_detail_control/';
const R2R_V2_TRIAL_002_OUTPUT_REF_PREFIX =
  'runs/real_generation/runtime_to_review_v2_trial_002_lantern_ecommerce_hero/';

const SERUM_BOTTLE_SECRETLESS_AUTHORIZED_ROUTE_ID_LIST = Object.freeze([
  'serum_bottle_vcptoolbox_route_owner_runtime',
  'serum_bottle_secretless_option_a',
  'secretless_serum_option_a',
]);

const AUTHORIZED_DOUBAO_PROJECT_BASE_PATH_OVERRIDES = Object.freeze({
  'AUTH-DRAFT-NATIVE-DOUBAO-SEEDREAM5-RETRY-20260526-003':
    'A:\\agent-image-lab\\agent-image-lab-v0.2\\runs\\real_generation\\v0_6_73_real_vcp_agent_generation_retry_003',
  'AUTH-DRAFT-NATIVE-DOUBAO-SEEDREAM5-RETRY-20260526-004':
    'A:\\agent-image-lab\\agent-image-lab-v0.2\\runs\\real_generation\\v0_6_73_real_vcp_agent_generation_retry_004',
  'AUTH-DRAFT-NATIVE-DOUBAO-SEEDREAM5-RETRY-20260526-005':
    'A:\\agent-image-lab\\agent-image-lab-v0.2\\runs\\real_generation\\v0_6_73_real_vcp_agent_generation_retry_005',
  'AUTH-DRAFT-NATIVE-DOUBAO-SEEDREAM5-RETRY-20260526-006':
    'A:\\agent-image-lab\\agent-image-lab-v0.2\\runs\\real_generation\\v0_6_73_real_vcp_agent_generation_retry_006',
  'AUTH-DRAFT-NATIVE-DOUBAO-SEEDREAM5-RETRY-20260527-007':
    'A:\\agent-image-lab\\agent-image-lab-v0.2\\runs\\real_generation\\v0_6_73_real_vcp_agent_generation_retry_007',
  'AUTH-DRAFT-NATIVE-DOUBAO-RUNTIME-TO-REVIEW-V1-20260529-001':
    'A:\\agent-image-lab\\agent-image-lab-v0.2\\runs\\real_generation\\runtime_to_review_v1_guarded_live_probe',
  [R2R_V2_TRIAL_002_EXACT_ACTIVATION_ID]:
    R2R_V2_TRIAL_002_EXACT_DOUBAO_PROJECT_BASE_PATH_OVERRIDE,
});

const AI_IMAGE_SECRETLESS_TRIAL_FIXTURES = Object.freeze({
  serumBottleSecretless: Object.freeze({
    mode: SERUM_BOTTLE_SECRETLESS_MODE,
    activationId: SERUM_BOTTLE_SECRETLESS_EXACT_ACTIVATION_ID,
    pipelineId: SERUM_BOTTLE_SECRETLESS_EXACT_PIPELINE_ID,
    receiptRef: SERUM_BOTTLE_SECRETLESS_EXACT_RECEIPT_REF,
    artifactRecordRef: SERUM_BOTTLE_SECRETLESS_EXACT_ARTIFACT_RECORD_REF,
    outputDirectoryRef: SERUM_BOTTLE_SECRETLESS_EXACT_OUTPUT_DIRECTORY_REF,
    outputRefPrefix: SERUM_BOTTLE_SECRETLESS_OUTPUT_REF_PREFIX,
    authorizedRouteIds: SERUM_BOTTLE_SECRETLESS_AUTHORIZED_ROUTE_ID_LIST,
  }),
  runtimeToReviewV2Trial001: Object.freeze({
    mode: R2R_V2_TRIAL_001_SECRETLESS_MODE,
    activationId: R2R_V2_TRIAL_001_EXACT_ACTIVATION_ID,
    pipelineId: R2R_V2_TRIAL_001_EXACT_PIPELINE_ID,
    promptPackageRef: R2R_V2_TRIAL_001_EXACT_PROMPT_PACKAGE_REF,
    receiptRef: R2R_V2_TRIAL_001_EXACT_RECEIPT_REF,
    artifactRecordRef: R2R_V2_TRIAL_001_EXACT_ARTIFACT_RECORD_REF,
    reviewBridgeRef: R2R_V2_TRIAL_001_EXACT_REVIEW_BRIDGE_REF,
    outputDirectoryRef: R2R_V2_TRIAL_001_EXACT_OUTPUT_DIRECTORY_REF,
    routeId: R2R_V2_TRIAL_001_ROUTE_ID,
    outputRefPrefix: R2R_V2_TRIAL_001_OUTPUT_REF_PREFIX,
  }),
  runtimeToReviewV2Trial002: Object.freeze({
    mode: R2R_V2_TRIAL_002_SECRETLESS_MODE,
    activationId: R2R_V2_TRIAL_002_EXACT_ACTIVATION_ID,
    pipelineId: R2R_V2_TRIAL_002_EXACT_PIPELINE_ID,
    promptPackageRef: R2R_V2_TRIAL_002_EXACT_PROMPT_PACKAGE_REF,
    receiptRef: R2R_V2_TRIAL_002_EXACT_RECEIPT_REF,
    artifactRecordRef: R2R_V2_TRIAL_002_EXACT_ARTIFACT_RECORD_REF,
    reviewBridgeRef: R2R_V2_TRIAL_002_EXACT_REVIEW_BRIDGE_REF,
    outputDirectoryRef: R2R_V2_TRIAL_002_EXACT_OUTPUT_DIRECTORY_REF,
    routeId: R2R_V2_TRIAL_002_ROUTE_ID,
    doubaoProjectBasePathOverride: R2R_V2_TRIAL_002_EXACT_DOUBAO_PROJECT_BASE_PATH_OVERRIDE,
    outputRefPrefix: R2R_V2_TRIAL_002_OUTPUT_REF_PREFIX,
  }),
});

const AI_IMAGE_DOUBAO_PROJECT_BASE_PATH_OVERRIDES =
  AUTHORIZED_DOUBAO_PROJECT_BASE_PATH_OVERRIDES;

module.exports = Object.freeze({
  AI_IMAGE_SECRETLESS_TRIAL_FIXTURES,
  AI_IMAGE_DOUBAO_PROJECT_BASE_PATH_OVERRIDES,
  SERUM_BOTTLE_SECRETLESS_MODE,
  R2R_V2_TRIAL_001_SECRETLESS_MODE,
  R2R_V2_TRIAL_002_SECRETLESS_MODE,
  SERUM_BOTTLE_SECRETLESS_EXACT_ACTIVATION_ID,
  SERUM_BOTTLE_SECRETLESS_EXACT_PIPELINE_ID,
  SERUM_BOTTLE_SECRETLESS_EXACT_RECEIPT_REF,
  SERUM_BOTTLE_SECRETLESS_EXACT_ARTIFACT_RECORD_REF,
  SERUM_BOTTLE_SECRETLESS_EXACT_OUTPUT_DIRECTORY_REF,
  R2R_V2_TRIAL_001_EXACT_ACTIVATION_ID,
  R2R_V2_TRIAL_001_EXACT_PIPELINE_ID,
  R2R_V2_TRIAL_001_EXACT_PROMPT_PACKAGE_REF,
  R2R_V2_TRIAL_001_EXACT_RECEIPT_REF,
  R2R_V2_TRIAL_001_EXACT_ARTIFACT_RECORD_REF,
  R2R_V2_TRIAL_001_EXACT_REVIEW_BRIDGE_REF,
  R2R_V2_TRIAL_001_EXACT_OUTPUT_DIRECTORY_REF,
  R2R_V2_TRIAL_001_ROUTE_ID,
  R2R_V2_TRIAL_002_EXACT_ACTIVATION_ID,
  R2R_V2_TRIAL_002_EXACT_PIPELINE_ID,
  R2R_V2_TRIAL_002_EXACT_PROMPT_PACKAGE_REF,
  R2R_V2_TRIAL_002_EXACT_RECEIPT_REF,
  R2R_V2_TRIAL_002_EXACT_ARTIFACT_RECORD_REF,
  R2R_V2_TRIAL_002_EXACT_REVIEW_BRIDGE_REF,
  R2R_V2_TRIAL_002_EXACT_OUTPUT_DIRECTORY_REF,
  R2R_V2_TRIAL_002_ROUTE_ID,
  R2R_V2_TRIAL_002_EXACT_DOUBAO_PROJECT_BASE_PATH_OVERRIDE,
  SERUM_BOTTLE_SECRETLESS_OUTPUT_REF_PREFIX,
  R2R_V2_TRIAL_001_OUTPUT_REF_PREFIX,
  R2R_V2_TRIAL_002_OUTPUT_REF_PREFIX,
  SERUM_BOTTLE_SECRETLESS_AUTHORIZED_ROUTE_ID_LIST,
  AUTHORIZED_DOUBAO_PROJECT_BASE_PATH_OVERRIDES,
});
