const path = require("node:path");
const postcss = require("postcss");
const plugin = (name) => {
  const module = require(`next/dist/compiled/postcss-modules-${name}`);
  return module.default || module;
};

// Use the same CSS Modules plugins bundled with Next, then inject the actual
// stylesheet into the isolated browser fixture. No production route is needed.
module.exports = function compile(source) {
  const done = this.async();
  const prefix = path.basename(this.resourcePath).replace(/[^a-z0-9]/gi, "_");
  postcss([
    plugin("values")(), plugin("local-by-default")({ mode: "local" }),
    plugin("extract-imports")(), plugin("scope")({ generateScopedName: (name) => `${prefix}_${name}` }),
  ]).process(source, { from: this.resourcePath }).then((result) => {
    const names = {};
    result.root.walkRules(":export", (rule) => {
      rule.walkDecls((declaration) => { names[declaration.prop] = declaration.value; });
      rule.remove();
    });
    done(null, `const style = document.createElement("style"); style.textContent = ${JSON.stringify(result.root.toString())}; document.head.appendChild(style); module.exports = ${JSON.stringify(names)};`);
  }, done);
};
