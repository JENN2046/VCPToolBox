'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('special model router is mounted after the generic Bearer gate', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const authGate = source.indexOf("if (!authHeader || authHeader !== `Bearer ${serverKey}`)");
    const specialMount = source.indexOf("app.use(specialModelRouter)");
    assert.ok(authGate >= 0, 'Bearer gate not found');
    assert.ok(specialMount > authGate, 'special model router must be mounted after Bearer auth');
});
