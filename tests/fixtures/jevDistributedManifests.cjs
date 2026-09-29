'use strict';

// Synthetic, non-executable schema fixtures. The upstream tests referenced
// VCPDistributedServer manifests that are not tracked in this repository.
// These exercise the routing contract without installing real device plugins.
function fixture(name, category, commands, defaultCommand) {
  return {
    name, pluginType: 'synchronous', version: 'test-fixture',
    capabilities: { invocationCommands: commands.map(({ commandIdentifier }) => ({ commandIdentifier })) },
    jev: { schemaVersion: 1, enabled: true, category, commands, defaultCommand,
      jevDescPrompt: '离线测试声明。', jevPrompt: '根据候选选项分类用户意图。' }
  };
}

function tableLamp() {
  return fixture('TableLampRemote', '物联网控制', [
    { commandIdentifier: 'LampControl', aliases: ['打开', '关闭', '开灯', '关灯', '调节'], parameters: {
      power: { type: 'boolean', description: '是否开灯', trueAliases: ['打开', '开灯'], falseAliases: ['关闭', '关灯'] },
      brightness: { type: 'text', source: 'constraints', prefixes: ['亮度'], maxLength: 4 },
      color_temperature: { type: 'text', source: 'constraints', prefixes: ['色温'], maxLength: 4 }
    } },
    { commandIdentifier: 'GetLampStatus', aliases: ['查询', '状态'] }
  ], 'LampControl');
}

function bladeGame() {
  const moves = { Charge: '蓄势', Slash: '斩击', LightStep: '轻霜踏雪', PlumBlossom: '寒梅逐鹿',
    Flash: '回光无影', Block: '御剑格挡', Taiji: '太极两仪' };
  return fixture('BladeGame', '媒体娱乐', [
    { commandIdentifier: 'StartGame', aliases: ['开始游戏'], parameters: {
      difficulty: { type: 'enum', description: '难度', values: { normal: '普通', hard: '困难' },
        aliases: { normal: ['普通'], hard: ['困难'] }, prefixes: ['难度'], default: 'normal' }
    } },
    { commandIdentifier: 'PlayTurn', aliases: ['出招', '使出', ...Object.values(moves)], parameters: {
      action: { type: 'enum', description: '招式', required: true, values: moves,
        aliases: Object.fromEntries(Object.entries(moves).map(([key, label]) => [key, [label]])) },
      reason: { type: 'text', source: 'constraints', maxLength: 200 }
    } }
  ], 'PlayTurn');
}

module.exports = { tableLamp, bladeGame };
