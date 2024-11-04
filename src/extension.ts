import * as vscode from 'vscode';
import { TestMonitorExtension } from './TestMonitorExtension';

export async function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Test Monitor');
    outputChannel.appendLine('Extension activated');
    console.log('Extension activated');
    
    const extension = new TestMonitorExtension(context);
    await extension.initialize();
    outputChannel.appendLine('Extension initialized');

    // Register commands
    const startWatchCommand = vscode.commands.registerCommand('test-monitor.startWatch', () => {
        extension.startWatchMode();
    });

    const stopWatchCommand = vscode.commands.registerCommand('test-monitor.stopWatch', () => {
        extension.stopWatchMode();
    });

    const startTestCommand = vscode.commands.registerCommand('test-monitor.start', () => {
        extension.startTestMonitor();
    });

    context.subscriptions.push(startWatchCommand, stopWatchCommand, startTestCommand);
    outputChannel.appendLine('Commands registered');
}

export function deactivate() {
    const outputChannel = vscode.window.createOutputChannel('Test Monitor');
    outputChannel.appendLine('Extension deactivated');
    console.log('Extension deactivated');
}