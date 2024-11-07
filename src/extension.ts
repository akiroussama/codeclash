import * as vscode from 'vscode';
import { TestMonitorExtension } from './TestMonitorExtension';
import { readPackageJson } from './utils/packageJson';
import { exec } from 'child_process';
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
    const startWatchCommand = vscode.commands.registerCommand('efrei.startWatch', () => {
        if (!extension) return;
        extension.startWatchMode();

        // Execute 'npm run test'
        exec('npm run test --watch', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing npm run test: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
        });
    });

    const stopWatchCommand = vscode.commands.registerCommand('efrei.stopWatch', () => {
        if (!extension) return;
        extension.stopWatchMode();
    });

    const startTestCommand = vscode.commands.registerCommand('efrei.start', () => {
        if (!extension) return;
        extension.startWatchMode();

        // Execute 'npm run test'
        exec('npm run test', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing npm run test: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
        });
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