import * as vscode from 'vscode';
import axios from 'axios';

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension activated');

  let disposable = vscode.workspace.onDidSaveTextDocument((document) => {
    console.log('onDidSaveTextDocument event triggered');
    vscode.window.showInformationMessage(`File saved: ${document.fileName}`);

    // Send data to the server
    axios.post('https://codeclashserver.onrender.com/update', {
      fileName: document.fileName,
      timestamp: new Date().toISOString()
    }).then(response => {
      console.log('Server response:', response.data);
    }).catch(error => {
      console.error('Error sending data to server:', error);
    });
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {
  console.log('Extension deactivated');
}