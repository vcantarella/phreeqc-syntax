// The only file that touches the vscode API. All logic lives in core.ts (plain,
// testable functions); this file just adapts documents/positions to strings.
import * as vscode from "vscode";
import { completionsFor, hoverFor, WORD_PATTERN, Item } from "./core";

const KIND: Record<Item["kind"], vscode.CompletionItemKind> = {
  keyword: vscode.CompletionItemKind.Keyword,
  option: vscode.CompletionItemKind.Property,
  basicFunction: vscode.CompletionItemKind.Function,
  basicStatement: vscode.CompletionItemKind.Keyword,
};

function lines(doc: vscode.TextDocument): string[] {
  return doc.getText().split(/\r?\n/);
}

export function activate(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = { language: "phreeqc" };

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      {
        provideCompletionItems(doc, pos) {
          // Range covering an already-typed "-" so accepting "-temp" never yields "--temp".
          const range = doc.getWordRangeAtPosition(pos, WORD_PATTERN);
          return completionsFor(lines(doc), pos.line).map((item) => {
            const ci = new vscode.CompletionItem(item.label, KIND[item.kind]);
            ci.detail = item.detail;
            ci.documentation = new vscode.MarkdownString(item.doc);
            ci.sortText = item.sortText;
            if (range) ci.range = range;
            if (item.snippet) ci.insertText = new vscode.SnippetString(item.snippet);
            return ci;
          });
        },
      },
      "-"
    ),

    vscode.languages.registerHoverProvider(selector, {
      provideHover(doc, pos) {
        const range = doc.getWordRangeAtPosition(pos, WORD_PATTERN);
        if (!range) return undefined;
        const markdown = hoverFor(doc.getText(range), lines(doc), pos.line);
        return markdown ? new vscode.Hover(new vscode.MarkdownString(markdown), range) : undefined;
      },
    })
  );
}

export function deactivate(): void {}
