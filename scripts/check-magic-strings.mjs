// Fails on hardcoded string values that carry meaning. Runs as part of `pnpm lint`, so CI enforces it.
// Two rules, for TypeScript source outside tests (see .claude/skills/code-quality):
//   1. A string literal compared with ===, !==, ==, != or used as a `case` label must be a named constant or an
//      enum-like `as const` value. Comparing against `typeof x` is exempt: those names are the language's own.
//   2. The same string literal may appear at most twice in a file; the third use means it needs a name.
// Exempt everywhere: import/export paths, literal types, property names, and `typeof` results.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";

const SOURCE = /^(apps|packages|plugins|workers)\/.*\/src\/.*\.tsx?$/;
const MAX_REPEATS = 2;
const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\0")
  .filter((f) => SOURCE.test(f) && !f.endsWith(".d.ts"));

const isString = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
const isTypeof = (n) => ts.isTypeOfExpression(ts.skipPartiallyEmittedExpressions(n));

/** Literals that are part of a declaration, a path or a type, not a value someone could mistype. */
function exempt(node) {
  const p = node.parent;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true;
  if (ts.isLiteralTypeNode(p) || ts.isImportTypeNode(p?.parent)) return true;
  if ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p)) && p.name === node)
    return true;
  if (ts.isCallExpression(p) && p.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
  if (ts.isBinaryExpression(p) && COMPARISONS.has(p.operatorToken.kind) && isTypeof(p.left === node ? p.right : p.left))
    return true;
  return node.text.length === 0;
}

const problems = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // deleted in the working tree but still in the index
  }
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const seen = new Map();
  const at = (n) => `${file}:${source.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;

  const visit = (node) => {
    if (ts.isBinaryExpression(node) && COMPARISONS.has(node.operatorToken.kind)) {
      for (const [side, other] of [
        [node.left, node.right],
        [node.right, node.left],
      ]) {
        if (isString(side) && !isTypeof(other)) problems.push(`  ${at(side)}: compares with "${side.text}"`);
      }
    }
    if (ts.isCaseClause(node) && isString(node.expression)) {
      problems.push(`  ${at(node.expression)}: case "${node.expression.text}"`);
    }
    if (isString(node) && !exempt(node)) {
      const list = seen.get(node.text) ?? [];
      list.push(node);
      seen.set(node.text, list);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  for (const [value, nodes] of seen) {
    if (nodes.length > MAX_REPEATS) problems.push(`  ${at(nodes[0])}: "${value}" appears ${nodes.length} times`);
  }
}

if (problems.length > 0) {
  console.error(`Name these values (a constant or an \`as const\` object) instead of repeating the string:`);
  console.error(problems.join("\n"));
  process.exit(1);
}
