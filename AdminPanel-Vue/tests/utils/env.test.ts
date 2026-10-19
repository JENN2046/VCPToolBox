import { describe, expect, it } from 'vitest'
import {
  inferEnvValueType,
  isSensitiveConfigKey,
  parseEnvToList,
  serializeEnvAssignment,
  serializeEnvValue,
} from '../../src/utils/env'

describe('env utilities', () => {
  it('parses quoted multiline values and preserves comments', () => {
    const entries = parseEnvToList('# heading\nAPI_KEY="line1\nline2"\nFLAG=true')

    expect(entries).toHaveLength(3)
    expect(entries[0]).toMatchObject({
      key: null,
      value: '# heading',
      isCommentOrEmpty: true
    })
    expect(entries[1]).toMatchObject({
      key: 'API_KEY',
      value: 'line1\nline2',
      isCommentOrEmpty: false,
      isMultilineQuoted: true
    })
    expect(entries[2]).toMatchObject({
      key: 'FLAG',
      value: 'true',
      isCommentOrEmpty: false
    })
  })

  it('round-trips values with quotes, hashes, backslashes and newlines', () => {
    expect(serializeEnvValue('plain-value')).toBe('plain-value')
    for (const value of ['value #1', 'line "one"\nline two', "it's quoted", 'C:\\notes\\next', 'both \" and \' quotes', ' leading ', '']) {
      const entries = parseEnvToList(serializeEnvAssignment('TITLE', value))
      expect(entries).toHaveLength(1)
      expect(entries[0]?.value).toBe(value)
    }
  })

  it('keeps token-like keys as string and only detects pure integers', () => {
    expect(inferEnvValueType('NEWAPI_MONITOR_ACCESS_TOKEN', '4TQJ6oxRC+vy6WrBlSsK2EFmapfZ')).toBe(
      'string'
    )
    expect(inferEnvValueType('tavilykey', '123456')).toBe('string')
    expect(inferEnvValueType('adminpassword', '123456')).toBe('string')
    expect(inferEnvValueType('WhitelistEmbeddingModelMaxToken', '3072')).toBe('integer')
    expect(inferEnvValueType('MODEL_ALIAS', '4o-mini')).toBe('string')
    expect(inferEnvValueType('RETRY_COUNT', '03')).toBe('integer')
  })

  it('detects concatenated sensitive keys while keeping token limits non-sensitive', () => {
    expect(isSensitiveConfigKey('tavilykey')).toBe(true)
    expect(isSensitiveConfigKey('TavilyKey')).toBe(true)
    expect(isSensitiveConfigKey('adminpassword')).toBe(true)
    expect(isSensitiveConfigKey('openaiApiKey')).toBe(true)

    expect(isSensitiveConfigKey('WhitelistEmbeddingModelMaxToken')).toBe(false)
    expect(isSensitiveConfigKey('MultiModalModelOutputMaxTokens')).toBe(false)
  })
})
