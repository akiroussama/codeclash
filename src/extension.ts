  import * as vscode from 'vscode';

  export function activate(context: vscode.ExtensionContext) {
    console.log('Extension activated');

    let disposable = vscode.workspace.onDidSaveTextDocument((document) => {
      console.log('onDidSaveTextDocument event triggered');
      vscode.window.showInformationMessage(`File saved: ${document.fileName}`);
    });

    context.subscriptions.push(disposable);
  }

  export function deactivate() {
    console.log('Extension deactivated');
  }