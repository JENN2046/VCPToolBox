const express = require('express');

module.exports = function sheetAIAdminModule() {
  const router = express.Router();
  const sheetAIRoutes = require('../sheetAIRoutes')();

  // 按照 MVP 文档要求，使用 /admin_api/sheetai/* 路由
  router.use('/admin_api/sheetai', sheetAIRoutes);
  return router;
};
