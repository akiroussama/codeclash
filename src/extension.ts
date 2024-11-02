import * as vscode from 'vscode';
import { exec } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    let statusBarItem: vscode.StatusBarItem;
    let testOutputChannel: vscode.OutputChannel;

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    testOutputChannel = vscode.window.createOutputChannel('Test Monitor');

    // Register command
    let disposable = vscode.commands.registerCommand('test-monitor.start', () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        
        // Update status bar
        statusBarItem.text = "$(sync~spin) Running tests...";
        statusBarItem.show();

        // Execute npm test
        const child = exec('npm run test', {
            cwd: workspacePath
        });

        let output = '';
        let errorOutput = '';

        child.stdout?.on('data', (data) => {
            output += data;
            testOutputChannel.append(data);
        });

        child.stderr?.on('data', (data) => {
            errorOutput += data;
            testOutputChannel.append(data);
        });

        child.on('close', (code) => {
            // Parse test results
            const results = parseTestResults(output);
            
            // Update status bar with results
            if (code === 0) {
                statusBarItem.text = `$(check) Tests: ${results.passed} passed`;
                statusBarItem.backgroundColor = new vscode.ThemeColor('statusBar.background');
            } else {
                statusBarItem.text = `$(error) Tests: ${results.failed} failed, ${results.passed} passed`;
                statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            }

            // Show notification
            if (code === 0) {
                vscode.window.showInformationMessage(`All tests passed! (${results.passed} tests)`);
            } else {
                vscode.window.showErrorMessage(`Tests failed: ${results.failed} failed, ${results.passed} passed`);
            }

            testOutputChannel.show();
        });
    });

    context.subscriptions.push(disposable, statusBarItem, testOutputChannel);
}

function parseTestResults(output: string): { passed: number; failed: number } {
    // This is a simple parser - you might need to adjust it based on your test runner's output
    const results = {
        passed: 0,
        failed: 0
    };

    // Look for common test output patterns
    const passedMatch = output.match(/(\d+)\s*passing/i);
    const failedMatch = output.match(/(\d+)\s*failing/i);

    if (passedMatch) {
        results.passed = parseInt(passedMatch[1]);
    }
    if (failedMatch) {
        results.failed = parseInt(failedMatch[1]);
    }

    return results;
}

export function deactivate() {}