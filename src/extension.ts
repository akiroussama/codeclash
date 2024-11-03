import * as vscode from 'vscode';
import { TestMonitorExtension } from './TestMonitorExtension';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Extension activated');
    
    const extension = new TestMonitorExtension(context);
    await extension.initialize();

    const disposable = vscode.commands.registerCommand('test-monitor.start', () => {
        extension.startTestMonitor();
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}