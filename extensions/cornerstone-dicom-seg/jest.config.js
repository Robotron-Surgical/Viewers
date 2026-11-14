const base = require('../../jest.config.base.js');

module.exports = {
  ...base,
  // The shared base transforms every dependency. This package's Babel config
  // does not cover private methods inside Jest itself, so leave node_modules alone.
  transformIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '@ohif/(.*)': '<rootDir>/../../platform/$1/src',
  },
};
