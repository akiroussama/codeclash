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
            await readPackageJson(workspaceFolders[0].uri.fsPath, outputChannel);
        } catch {
            vscode.window.showWarningMessage('No package.json found. Some features may not work until you initialize a Node.js project.');
        }
    }
    
    extension = new TestMonitorExtension(context);
    await extension.initialize();
    outputChannel.appendLine('Extension initialized');

    // Register commands
    const startTestCommand = vscode.commands.registerCommand('efrei.start', async () => {
        if (!extension) {
            return;
        }
        await extension.startTestMonitor();
    });

    const startWatchCommand = vscode.commands.registerCommand('efrei.startWatch', () => {
        if (!extension) return;
        extension.startWatchMode();
    });

    const stopWatchCommand = vscode.commands.registerCommand('efrei.stopWatch', () => {
        if (!extension) return;
        extension.stopWatchMode();
    });

    context.subscriptions.push(startTestCommand, startWatchCommand, stopWatchCommand);
    outputChannel.appendLine('Commands registered');
}

export function deactivate() {
    const outputChannel = vscode.window.createOutputChannel('Clash of code');
    outputChannel.appendLine('Extension deactivated');

    if (extension) {
        extension.stopWatchMode();
    }
}