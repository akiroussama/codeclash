import * as vscode from 'vscode';
import axios from 'axios';

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.workspace.onDidSaveTextDocument((document) => {
    // Log to confirm the event is triggered
    console.log('onDidSaveTextDocument event triggered');

    // Send data to the server
    const text = 'coucou toi';
    axios.post('http://localhost:3000/update', {
      data: { text: text }
    }).then(response => {
      // Log the response from the server
      console.log('Server response:', response.data);
    }).catch(error => {
      console.error('Error sending data to server:', error);
    });

    vscode.window.showInformationMessage(`File saved: ${document.fileName}`);
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}