import * as vscode from 'vscode';
import { TestMonitorExtension } from './TestMonitorExtension';

let extension: TestMonitorExtension | undefined;

export async function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Clash of code');
    outputChannel.appendLine('Extension activated');
    console.log('Extension activated');
    
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