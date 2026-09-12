const ts = require("typescript");

// The standalone admin control fixture uses the project's installed compiler.
module.exports = function compile(source) {
  return ts.transpileModule(source, {
    fileName: this.resourcePath,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
};
