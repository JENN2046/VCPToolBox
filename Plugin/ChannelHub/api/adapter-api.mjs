// Stable public ESM boundary for independently installed ChannelHub adapters.
// Keep this import path and export names compatible within API major version 1.
import internal from '../core/AdapterContract.js';
export const ADAPTER_API_VERSION = 1;
export const AdapterContract = internal.AdapterContract;
export const HttpWebhookAdapterBase = internal.HttpWebhookAdapterBase;
export const createAdapter = internal.createAdapter;
export const validateAdapterContract = internal.validateAdapterContract;
export const createPlatformMessage = internal.createPlatformMessage;
export const AdapterContractError = internal.AdapterContractError;
export const UnsupportedCapabilityError = internal.UnsupportedCapabilityError;
export const AdapterNotImplementedError = internal.AdapterNotImplementedError;
