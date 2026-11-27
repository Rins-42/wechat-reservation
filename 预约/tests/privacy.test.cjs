const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root } = require('../scripts/check.cjs');

function loadApplication(configLoader) {
  let app;
  const initializations = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), {
    App(value) { app = value; },
    require(name) {
      assert.equal(name, './config.local');
      return configLoader();
    },
    wx: {
      cloud: {
        init(value) { initializations.push(value); },
        async callFunction() { return { result: { isAdmin: false } }; }
      }
    },
    console: { error() {} }
  });
  app.getOpenId = async () => 'test-identity';
  app.checkUserInfo = async () => true;
  return { app, initializations };
}

test('public configuration examples contain only placeholder identifiers', () => {
  const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.example.json'), 'utf8'));
  assert.equal(project.appid, 'YOUR_WECHAT_APPID');
  assert.equal(require('../config.example').cloudEnvId, 'YOUR_CLOUD_ENV_ID');
});

test('missing local configuration does not initialize an unintended cloud environment', () => {
  const { app, initializations } = loadApplication(() => { throw new Error('MODULE_NOT_FOUND'); });
  app.onLaunch();
  assert.equal(initializations.length, 0);
});

test('placeholder local configuration does not initialize the cloud environment', () => {
  const { app, initializations } = loadApplication(() => ({ cloudEnvId: 'YOUR_CLOUD_ENV_ID' }));
  app.onLaunch();
  assert.equal(initializations.length, 0);
});

test('startup uses the developer local environment configuration', async () => {
  const { app, initializations } = loadApplication(() => ({ cloudEnvId: ' test-environment ' }));
  app.onLaunch();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(initializations.length, 1);
  assert.equal(initializations[0].env, 'test-environment');
});

test('public application files contain no project identifiers or payload debug logs', () => {
  function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      if (['node_modules', 'miniprogram_npm', '.git'].includes(entry.name)) return [];
      if (['config.local.js', 'project.config.json', 'project.private.config.json'].includes(entry.name)) return [];
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });
  }
  for (const file of walk(root)) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\bwx[a-f0-9]{16}\b|\bcloud[0-9]-[a-z0-9-]+\b/, path.relative(root, file));
    if (file.endsWith('.js') && !file.includes(path.sep + 'tests' + path.sep)) {
      assert.doesNotMatch(source, /console\.(?:log|debug|info)\s*\(/, path.relative(root, file));
    }
  }
});
