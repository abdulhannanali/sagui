import 'babel-polyfill'
import { expect } from 'chai'
import fs from 'fs-extra'
import path from 'path'
import jsdom from 'jsdom'
import sagui, { InvalidSaguiConfig } from '../../src'
import actions from '../../src/actions'
import temp from 'temp'

// make sure the temp folders are cleaned up
temp.track()

/**
 * Simulate a complete install of Sagui in a target folder.
 *
 * It symlinks all the dependencies in place
 * and copies the required Sagui files.
 */
const npmInstall = (projectPath) => {
  const nodeModules = path.join(__dirname, '../../node_modules')
  const packages = fs.readdirSync(nodeModules)

  packages.forEach((name) => fs.ensureSymlinkSync(path.join(nodeModules, name), path.join(projectPath, 'node_modules', name)))

  const saguiInNodeModules = path.join(projectPath, 'node_modules/sagui/karma-static-files')
  fs.ensureDirSync(saguiInNodeModules)
  fs.copySync(path.join(__dirname, '../../karma-static-files'), saguiInNodeModules)
}

describe('[integration] sagui', function () {
  const projectFixture = path.join(__dirname, '../fixtures/simple-project')
  const projectContent = path.join(__dirname, '../fixtures/project-content')
  const projectContentWithLintErrors = path.join(__dirname, '../fixtures/project-content-with-lint-errors')
  const projectContentWithPrettierErrors = path.join(__dirname, '../fixtures/project-content-with-prettier-errors')
  let projectPath, projectSrcPath

  beforeEach(function () {
    projectPath = temp.mkdirSync('sagui-test-project')
    projectSrcPath = path.join(projectPath, 'src')

    npmInstall(projectPath)
    fs.copySync(projectFixture, projectPath)
  })

  describe('after update', () => {
    beforeEach(() => {
      return sagui({ projectPath, action: actions.UPDATE })
    })

    it('should be possible to build', () => {
      return sagui({ projectPath, action: actions.BUILD })
    })

    it('should be possible to test', () => {
      return sagui({ projectPath, action: actions.TEST_UNIT })
    })

    it('should be possible to lint', () => {
      return sagui({ projectPath, action: actions.TEST_LINT })
    })

    it('should be possible to test (with coverage)', () => {
      return sagui({ projectPath, action: actions.TEST_UNIT, coverage: true })
    })

    it('should have an .gitignore, .flowconfig and .editorconfig file', () => {
      fs.readFileSync(path.join(projectPath, '.gitignore'))
      fs.readFileSync(path.join(projectPath, '.flowconfig'))
      fs.readFileSync(path.join(projectPath, '.editorconfig'))
    })

    it('should add sagui scripts to the project', () => {
      expect(JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'))).scripts.build).eql('sagui build')
    })

    it('should not try to re-write packageJSON on new updates if content is the same', () => {
      // make the package.json read only
      fs.chmodSync(path.join(projectPath, 'package.json'), '0444')
      return sagui({ projectPath, action: actions.UPDATE })
    })

    describe('once we add content', () => {
      beforeEach(function () {
        fs.copySync(projectContent, projectSrcPath, { overwrite: true })
      })

      it('should be possible to build', () => {
        return sagui({ projectPath, action: actions.BUILD })
      })

      it('should be possible to test more files', () => {
        return sagui({ projectPath, action: actions.TEST_UNIT })
      })

      it('should be possible to keep updating Sagui', () => {
        return sagui({ projectPath, action: actions.UPDATE })
      })
    })

    describe('project with transpile dependencies', () => {
      const projectWithTranspileDependencies = path.join(__dirname, '../fixtures/project-with-transpile-dependencies')
      beforeEach(function () {
        fs.copySync(projectWithTranspileDependencies, projectPath, { overwrite: true })
      })

      it('should be possible to build', () => {
        return sagui({ projectPath, action: actions.BUILD })
      })

      it('should be possible to test', () => {
        return sagui({ projectPath, action: actions.TEST_UNIT })
      })
    })

    describe('project with type definitions', () => {
      const projectContentWithTypes = path.join(__dirname, '../fixtures/project-content-with-types')
      beforeEach(function () {
        fs.copySync(projectContentWithTypes, projectSrcPath, { overwrite: true })
      })

      it('should be possible to build', () => {
        return sagui({ projectPath, action: actions.BUILD })
      })

      it('should be possible to type check', () => {
        return sagui({ projectPath, action: actions.TEST_TYPECHECK })
      })
    })

    describe('project with invalid type definitions', () => {
      const projectContentWithInvalidTypes = path.join(__dirname, '../fixtures/project-content-with-invalid-types')
      beforeEach(function () {
        fs.copySync(projectContentWithInvalidTypes, projectSrcPath, { overwrite: true })
      })

      it('should still be possible to build', () => {
        return sagui({ projectPath, action: actions.BUILD })
      })

      it('should fail at type check', () => {
        return sagui({ projectPath, action: actions.TEST_TYPECHECK })
          .then(
            () => { throw new Error('It should have failed') },
            (error) => expect(error.message).to.eql('Type check failed')
          )
      })
    })

    describe('project with invalid configuration', () => {
      const projectWithInvalidConfig = path.join(__dirname, '../fixtures/project-with-invalid-config')
      beforeEach(function () {
        fs.copySync(projectWithInvalidConfig, projectPath, { overwrite: true })
      })

      it('should not be possible to build', () => {
        return sagui({ projectPath, action: actions.BUILD })
          .then(
            () => { throw new Error('It should have failed') },
            (error) => expect(error).instanceof(InvalidSaguiConfig)
          )
      })
    })

    describe('style loader', () => {
      const projectWithCSSModules = path.join(__dirname, '../fixtures/project-with-css-modules')
      const htmlFile = path.join(__dirname, '../fixtures/index.html')

      beforeEach((done) => {
        fs.copySync(projectWithCSSModules, projectPath, { overwrite: true })

        jsdom.env(htmlFile, (err, window) => {
          global.window = window
          global.document = window.document
          done()
        });
      })

      afterEach(() => {
        global.window.close()
        delete global.window
        delete global.document
      })

      it('should build with the unique CSS Modules keys', () => {
        return sagui({ projectPath, action: actions.BUILD }).then(() => {
          const dist = require(path.join(projectPath, '/dist/index')).default

          expect(dist.componentA).to.match(/content-.{5}/)
          expect(dist.componentB).to.match(/content-.{5}/)
          expect(dist.componentA).not.to.eql(dist.componentB)
        })
      })

      it('should build (optimized) with the unique CSS Modules keys', () => {
        return sagui({ projectPath, action: actions.BUILD, optimize: true }).then(() => {
          const dist = require(path.join(projectPath, '/dist/index')).default

          expect(dist.componentA).to.match(/^.{5,6}$/)
          expect(dist.componentB).to.match(/^.{5,6}$/)
          expect(dist.componentA).not.to.eql(dist.componentB)
        })
      })

      it('should autoprefix CSS rules', () => {
        return sagui({ projectPath, action: actions.BUILD }).then(() => {
          const dist = fs.readFileSync(path.join(projectPath, '/dist/index.js'))

          expect(dist).to.match(/-ms-flex/)
        })
      })
    })

    describe('once we add content with lint errors', () => {
      beforeEach(function () {
        fs.copySync(projectContentWithLintErrors, projectSrcPath, { overwrite: true })
      })

      it('should break the build', () => {
        return sagui({ projectPath, action: actions.BUILD })
          .then(
            () => { throw new Error('It should have failed') },
            (error) => expect(error.message).to.eql('Build failed')
          )
      })

      it('should break the linter', () => {
        return sagui({ projectPath, action: actions.TEST_LINT })
          .then(
            () => { throw new Error('It should have failed') },
            (error) => expect(error.message).to.eql('Lint failed')
          )
      })
    })

    describe('once we add content with prettier errors', () => {
      beforeEach(function () {
        fs.copySync(projectContentWithPrettierErrors, projectSrcPath, { overwrite: true })
      })

      it('should break the build', () => {
        return sagui({ projectPath, action: actions.BUILD })
          .then(
            () => { throw new Error('It should have failed') },
            (error) => expect(error.message).to.eql('Build failed')
          )
      })

      it('should break the linter', () => {
        return sagui({ projectPath, action: actions.TEST_LINT })
          .then(
            () => { throw new Error('It should have failed') },
            (error) => expect(error.message).to.eql('Lint failed')
          )
      })

      it('should be possible to format it and remove the errors', async () => {
        await sagui({ projectPath, action: actions.FORMAT })
        await sagui({ projectPath, action: actions.BUILD })
      })
    })
  })
})
