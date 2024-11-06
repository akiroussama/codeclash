import * as vscode from 'vscode';
import { TestMonitorExtension } from './TestMonitorExtension';
import { readPackageJson } from './utils/packageJson';
let extension: TestMonitorExtension | undefined;

export async function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Clash of code');
    outputChannel.appendLine('Extension activated');
    
    // Check if we're in a Node.js project
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        try {
            await readPackageJson(workspaceFolders[0].uri.fsPath);
        } catch {
            vscode.window.showWarningMessage('No package.json found. Some features may not work until you initialize a Node.js project.');
        }
    }
    
    extension = new TestMonitorExtension(context);
    await extension.initialize();
    outputChannel.appendLine('Extension initialized');

    // Register commands
    const startWatchCommand = vscode.commands.registerCommand('efrei.startWatch', () => {
        if (!extension) return;
        extension.startWatchMode();
    });

    const stopWatchCommand = vscode.commands.registerCommand('efrei.stopWatch', () => {
        if (!extension) return;
        extension.stopWatchMode();
    });

    const startTestCommand = vscode.commands.registerCommand('efrei.start', () => {
        if (!extension) return;
        extension.startTestMonitor();
    });

    context.subscriptions.push(startWatchCommand, stopWatchCommand, startTestCommand);
    outputChannel.appendLine('Commands registered');
}

export function deactivate() {
    const outputChannel = vscode.window.createOutputChannel('Clash of code');
    outputChannel.appendLine('Extension deactivated');
    console.log('Extension deactivated');

    // Clean up resources
    if (extension) {
        extension.stopWatchMode();
    }
}