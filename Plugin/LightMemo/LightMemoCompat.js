'use strict';

const lightMemo = require('./LightMemo.js');
const {
  applyLightMemoCompatibility
} = require('../../modules/lightMemoCompatibility.js');

module.exports = applyLightMemoCompatibility(lightMemo);
