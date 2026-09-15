'use strict';

const PROFILES = Object.freeze({
  'vcp_chat.c1.fixture': Object.freeze({
    id: 'vcp_chat.c1.fixture',
    activation: 'TEST_ONLY'
  }),
  'vcp_chat.c2': Object.freeze({
    id: 'vcp_chat.c2',
    activation: 'PRODUCTION_DISABLED'
  })
});

function profile(store) {
  return store.testOnly ? PROFILES['vcp_chat.c1.fixture'] : PROFILES['vcp_chat.c2'];
}

function productionAdmitted(record) {
  return PROFILES[record?.implementationProfileId]?.activation === 'PRODUCTION_ADMITTED';
}

module.exports = {
  PROFILES,
  profile,
  productionAdmitted
};
