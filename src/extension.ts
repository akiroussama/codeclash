import * as vscode from 'vscode';
import { TestMonitorExtension } from './TestMonitorExtension';

export async function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Test Monitor');
    outputChannel.appendLine('Extension activated');
    console.log('Extension activated');
    
    const extension = new TestMonitorExtension(context);
    await extension.initialize();
    outputChannel.appendLine('Extension initialized');

    const disposable = vscode.commands.registerCommand('test-monitor.start', () => {
        outputChannel.appendLine('Command test-monitor.start executed');
        extension.startTestMonitor();
    });

    context.subscriptions.push(disposable);
    outputChannel.appendLine('Command registered and added to subscriptions');
}

export function deactivate() {
    const outputChannel = vscode.window.createOutputChannel('Test Monitor');
    outputChannel.appendLine('Extension deactivated');
    console.log('Extension deactivated');
}