'use strict';

const BbPromise = require('bluebird');
const chai = require('chai');
const sinon = require('sinon');
const Package = require('../package');
const Serverless = require('../../../Serverless');

// Configure chai
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
const expect = require('chai').expect;

describe('#packageService()', () => {
  let serverless;
  let packagePlugin;

  beforeEach(() => {
    serverless = new Serverless();
    packagePlugin = new Package(serverless, {});
    packagePlugin.serverless.cli = new serverless.classes.CLI();
    packagePlugin.serverless.service.functions = {
      first: {
        handler: 'foo',
      },
    };
  });

  describe('#getIncludes()', () => {
    it('should return an empty array if no includes are provided', () => {
      const include = packagePlugin.getIncludes();

      expect(include).to.deep.equal([]);
    });

    it('should merge package includes', () => {
      const packageIncludes = [
        'dir', 'file.js',
      ];

      serverless.service.package.include = packageIncludes;

      const include = packagePlugin.getIncludes();
      expect(include).to.deep.equal([
        'dir', 'file.js',
      ]);
    });

    it('should merge package and func includes', () => {
      const funcIncludes = [
        'lib', 'other.js',
      ];
      const packageIncludes = [
        'dir', 'file.js',
      ];

      serverless.service.package.include = packageIncludes;

      const include = packagePlugin.getIncludes(funcIncludes);
      expect(include).to.deep.equal([
        'dir', 'file.js',
        'lib', 'other.js',
      ]);
    });
  });

  describe('#getExcludes()', () => {
    it('should exclude defaults', () => {
      const exclude = packagePlugin.getExcludes();
      expect(exclude).to.deep.equal(packagePlugin.defaultExcludes);
    });

    it('should merge defaults with excludes', () => {
      const packageExcludes = [
        'dir', 'file.js',
      ];

      serverless.service.package.exclude = packageExcludes;

      const exclude = packagePlugin.getExcludes();
      expect(exclude).to.deep.equal([
        '.git/**', '.gitignore', '.DS_Store',
        'npm-debug.log',
        'serverless.yaml', 'serverless.yml',
        '.serverless/**', 'dir', 'file.js',
      ]);
    });

    it('should merge defaults with package and func excludes', () => {
      const funcExcludes = [
        'lib', 'other.js',
      ];
      const packageExcludes = [
        'dir', 'file.js',
      ];

      serverless.service.package.exclude = packageExcludes;

      const exclude = packagePlugin.getExcludes(funcExcludes);
      expect(exclude).to.deep.equal([
        '.git/**', '.gitignore', '.DS_Store',
        'npm-debug.log',
        'serverless.yaml', 'serverless.yml',
        '.serverless/**', 'dir', 'file.js',
        'lib', 'other.js',
      ]);
    });
  });

  describe('#packageService()', () => {
    it('should package all functions', () => {
      serverless.service.package.individually = false;

      const packageAllStub = sinon
        .stub(packagePlugin, 'packageAll').resolves();

      return expect(packagePlugin.packageService()).to.be.fulfilled
      .then(() => expect(packageAllStub).to.be.calledOnce);
    });

    it('should package functions individually', () => {
      serverless.service.package.individually = true;
      serverless.service.functions = {
        'test-one': {
          name: 'test-one',
        },
        'test-two': {
          name: 'test-two',
        },
      };

      const packageFunctionStub = sinon
        .stub(packagePlugin, 'packageFunction').resolves((func) => func.name);

      return expect(packagePlugin.packageService()).to.be.fulfilled
      .then(() => expect(packageFunctionStub).to.be.calledTwice);
    });

    it('should package single function individually', () => {
      serverless.service.functions = {
        'test-one': {
          name: 'test-one',
          package: {
            individually: true,
          },
        },
        'test-two': {
          name: 'test-two',
        },
      };

      const packageFunctionStub = sinon
        .stub(packagePlugin, 'packageFunction').resolves((func) => func.name);
      const packageAllStub = sinon
        .stub(packagePlugin, 'packageAll').resolves((func) => func.name);

      return expect(packagePlugin.packageService()).to.be.fulfilled
      .then(() => BbPromise.join(
        expect(packageFunctionStub).to.be.calledOnce,
        expect(packageAllStub).to.be.calledOnce
      ));
    });
  });

  describe('#packageAll()', () => {
    const exclude = ['test-exclude'];
    const include = ['test-include'];
    const artifactFilePath = '/some/fake/path/test-artifact.zip';
    let getExcludesStub;
    let getIncludesStub;
    let zipDirectoryStub;

    beforeEach(() => {
      getExcludesStub = sinon
        .stub(packagePlugin, 'getExcludes').returns(exclude);
      getIncludesStub = sinon
        .stub(packagePlugin, 'getIncludes').returns(include);
      zipDirectoryStub = sinon
        .stub(packagePlugin, 'zipDirectory').resolves(artifactFilePath);
    });

    afterEach(() => {
      packagePlugin.getExcludes.restore();
      packagePlugin.getIncludes.restore();
      packagePlugin.zipDirectory.restore();
    });

    it('should call zipService with settings', () => {
      const servicePath = 'test';
      const zipFileName = `${serverless.service.service}.zip`;

      serverless.config.servicePath = servicePath;

      return expect(packagePlugin.packageService()).to.be.fulfilled
      .then(() => BbPromise.all([
        expect(getExcludesStub).to.be.calledOnce,
        expect(getIncludesStub).to.be.calledOnce,
        expect(zipDirectoryStub).to.be.calledOnce,
        expect(zipDirectoryStub).to.have.been.calledWithExactly(
          exclude,
          include,
          zipFileName
        ),
      ]));
    });
  });

  describe('#packageFunction()', () => {
    const exclude = ['test-exclude'];
    const include = ['test-include'];
    const artifactFilePath = '/some/fake/path/test-artifact.zip';
    let getExcludesStub;
    let getIncludesStub;
    let zipDirectoryStub;

    beforeEach(() => {
      getExcludesStub = sinon
        .stub(packagePlugin, 'getExcludes').returns(exclude);
      getIncludesStub = sinon
        .stub(packagePlugin, 'getIncludes').returns(include);
      zipDirectoryStub = sinon
        .stub(packagePlugin, 'zipDirectory').resolves(artifactFilePath);
    });

    afterEach(() => {
      packagePlugin.getExcludes.restore();
      packagePlugin.getIncludes.restore();
      packagePlugin.zipDirectory.restore();
    });

    it('should call zipService with settings', () => {
      const servicePath = 'test';
      const funcName = 'test-func';

      const zipFileName = 'test-func.zip';

      serverless.config.servicePath = servicePath;
      serverless.service.functions = {};
      serverless.service.functions[funcName] = { name: `test-proj-${funcName}` };

      return expect(packagePlugin.packageFunction(funcName)).to.eventually.equal(artifactFilePath)
      .then(() => BbPromise.all([
        expect(getExcludesStub).to.be.calledOnce,
        expect(getIncludesStub).to.be.calledOnce,

        expect(zipDirectoryStub).to.be.calledOnce,
        expect(zipDirectoryStub).to.have.been.calledWithExactly(
          exclude,
          include,
          zipFileName
        ),
      ]));
    });
  });
});
