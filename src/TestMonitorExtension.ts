import * as vscode from 'vscode';
import { exec } from 'child_process';
import axios from 'axios';
import { getSystemInfo } from './systemInfo';
import { readPackageJson } from './utils/packageJson';
import { TestResult, TestRunMetadata } from './types';

export class TestMonitorExtension {
    private projectInfo: any;
    private gitInfo: any;
    private testRunnerInfo: any;
    private username: string | undefined;
    private statusBarItem: vscode.StatusBarItem;
    private testOutputChannel: vscode.OutputChannel;
    private outputChannel: vscode.OutputChannel;
    private context: vscode.ExtensionContext;
    private isWatching: boolean = false;
    private fileWatcher: vscode.FileSystemWatcher | undefined;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.testOutputChannel = vscode.window.createOutputChannel('Test Monitor');
        this.outputChannel = vscode.window.createOutputChannel('Test Monitor Debug');
        this.outputChannel.appendLine('TestMonitorExtension initialized');
    }

    async initialize() {
        this.outputChannel.appendLine('Initializing extension');
        this.username = this.context.globalState.get('username') || '';
        this.outputChannel.appendLine(`Retrieved username: ${this.username}`);
        // get the username from the github login
        if(!this.username){
            this.username = await this.getGithubUsername();
            this.outputChannel.appendLine(`User: ${this.username}`);
        }

        if (!this.username) {
            await this.promptForUsername();
        }
    }

    private async getGithubUsername(): Promise<string | undefined> {
        this.outputChannel.appendLine('Attempting to get GitHub username');
        try {
            const session = await vscode.authentication.getSession('github', ['read:user'], { createIfNone: true });
            if (session) {
                const username = session.account.label;
                vscode.window.showInformationMessage(`Logged in as: ${username}`);
                return username;
            }
            vscode.window.showErrorMessage('No session found');
            return undefined;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error getting username: ${error.message}`);
            return undefined;
        }
    }

    private async promptForUsername(): Promise<void> {
        this.outputChannel.appendLine('Prompting for username');
        let input: string | undefined;
        
        while (!input) {
            input = await vscode.window.showInputBox({
                prompt: 'Enter your username',
                ignoreFocusOut: true,
                placeHolder: 'username',
                validateInput: (value) => value && value.trim() ? null : 'Username cannot be empty'
            });

            if (!input) {
                await vscode.window.showErrorMessage('Username is required to use this extension.');
            }
        }

        this.username = input;
        await this.context.globalState.update('username', this.username);
        this.outputChannel.appendLine(`Username updated: ${this.username}`);
    }

    private async getGitInfo(workspacePath: string): Promise<any> {
        this.outputChannel.appendLine('Fetching Git info');
        try {
            const execPromise = (command: string) => new Promise((resolve) => {
                exec(command, { cwd: workspacePath }, (err, stdout) => {
                    resolve(err ? '' : stdout.trim());
                });
            });

            const [branch, commit, remote] = await Promise.all([
                execPromise('git rev-parse --abbrev-ref HEAD'),
                execPromise('git rev-parse HEAD'),
                execPromise('git remote get-url origin')
            ]);

            return { branch, commit, remote };
        } catch (error) {
            console.error('Error fetching Git info:', error);
            return undefined;
        }
    }

    private async getProjectInfo(workspacePath: string): Promise<any> {
        this.outputChannel.appendLine('Fetching project info');
        try {
            const packageJson = await readPackageJson(workspacePath);
            return {
                name: packageJson.name,
                version: packageJson.version,
                dependencies: packageJson.dependencies,
                scripts: packageJson.scripts
            };
        } catch (error) {
            console.error('Error fetching project info:', error);
            return undefined;
        }
    }

    private async getTestRunnerInfo(workspacePath: string): Promise<any> {
        this.outputChannel.appendLine('Fetching test runner info');
        const packageJson = await readPackageJson(workspacePath);
        let testRunner = 'unknown';
        let version = '';
        let config = {};

        if (packageJson.dependencies?.vitest || packageJson.devDependencies?.vitest) {
            testRunner = 'vitest';
            version = packageJson.dependencies?.vitest || packageJson.devDependencies?.vitest;
        } else if (packageJson.dependencies?.jest || packageJson.devDependencies?.jest) {
            testRunner = 'jest';
            const jestConfig = await import(`${workspacePath}/jest.config.js`).catch(() => ({}));
            config = jestConfig;
            version = packageJson.dependencies?.jest || packageJson.devDependencies?.jest;
        } else if (packageJson.dependencies?.mocha || packageJson.devDependencies?.mocha) {
            testRunner = 'mocha';
            version = packageJson.dependencies?.mocha || packageJson.devDependencies?.mocha;
        }

        return { name: testRunner, version, config };
    }

    private parseTestResults(output: string): TestResult {
        this.outputChannel.appendLine('Parsing test results');
        const results: TestResult = {
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            total: 0,
            testFiles: [],
            failureDetails: []
        };

        const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');

        // Parse test files and their status for Vitest
        const fileTestPattern = /([^\s]+\.(?:test|spec)\.[jt]sx?)\s*\((\d+)\s*tests?\s*\|\s*(\d+)\s*failed\)/g;
        let fileMatch;
        while ((fileMatch = fileTestPattern.exec(cleanOutput)) !== null) {
            results.testFiles.push(fileMatch[1]);
        }

        // Parse overall test results for Vitest
        const vitestPattern = /Tests\s*(\d+)\s*failed\s*\|\s*(\d+)\s*passed\s*\((\d+)\)/;
        const vitestMatch = cleanOutput.match(vitestPattern);
        if (vitestMatch) {
            results.failed = parseInt(vitestMatch[1]);
            results.passed = parseInt(vitestMatch[2]);
            results.total = parseInt(vitestMatch[3]);
        }

        // Parse duration
        const durationPattern = /Duration\s*(\d+(?:\.\d+)?)(m?s)/;
        const durationMatch = cleanOutput.match(durationPattern);
        if (durationMatch) {
            const value = parseFloat(durationMatch[1]);
            const unit = durationMatch[2];
            results.duration = unit === 'ms' ? value / 1000 : value;
        }

        // Parse failure details
        const failurePattern = /×\s*(.*?)\s*(\d+)ms\n\s*→\s*((?:[^×]|[\s\S])*?)(?=\n\s*(?:×|\n|Test Files|$))/g;
        let failureMatch;
        while ((failureMatch = failurePattern.exec(cleanOutput)) !== null) {
            results.failureDetails.push({
                testName: failureMatch[1].trim(),
                error: failureMatch[3].trim(),
                duration: parseInt(failureMatch[2])
            });
        }

        console.log('Parsed test results:', results);
        return results;
    }

    private async sendTestStatusUpdate(testResults: TestResult, startTime: Date) {
        this.outputChannel.appendLine('Preparing to send test status update');
        this.outputChannel.appendLine(`Test results: ${JSON.stringify(testResults)}`);
        if (!testResults.total) {
            console.log('No test results to send');
            return;
        }

        const statusUpdate = {
            user: this.username,
            timestamp: new Date().toISOString(),
            testStatus: {
                passed: testResults.passed,
                failed: testResults.failed,
                skipped: testResults.skipped,
                duration: testResults.duration,
                total: testResults.total,
                testFiles: testResults.testFiles,
                failureDetails: testResults.failureDetails
            },
            projectInfo: this.projectInfo,
            gitInfo: this.gitInfo,
            testRunnerInfo: this.testRunnerInfo,
            environment: {
                nodeVersion: process.version,
                vscodeVersion: vscode.version,
                platform: process.platform,
                osInfo: await getSystemInfo(),
                workspace: {
                    name: vscode.workspace.workspaceFolders?.[0].name || '',
                    path: vscode.workspace.workspaceFolders?.[0].uri.fsPath || '',
                    gitInfo: this.gitInfo
                }
            },
            execution: {
                startTime: startTime.toISOString(),
                endTime: new Date().toISOString(),
                duration: testResults.duration * 1000,
                exitCode: 0
            }
        };

        try {
            await axios.post('https://codeclashserver.onrender.com/test-status', statusUpdate);
            console.log('Test status update sent successfully');
        } catch (error) {
            console.error('Error sending test status update:', error);
        }
    }

    async startTestMonitor() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        const startTime = new Date();
        
        // Update status bar to show running state
        this.statusBarItem.text = this.isWatching ? 
            "$(sync~spin) Running tests (Watch Mode)..." :
            "$(sync~spin) Running tests...";
        this.statusBarItem.show();

        // Update project information
        this.gitInfo = await this.getGitInfo(workspacePath);
        this.projectInfo = await this.getProjectInfo(workspacePath);
        this.testRunnerInfo = await this.getTestRunnerInfo(workspacePath);

        let output = '';
        let errorOutput = '';

        const child = exec('npm run test', { cwd: workspacePath });

        child.stdout?.on('data', (data) => {
            this.outputChannel.appendLine('Received stdout data');
            output += data;
            this.testOutputChannel.append(data);
            const testResults = this.parseTestResults(data);
            this.sendTestStatusUpdate(testResults, startTime);
        });

        child.stderr?.on('data', (data) => {
            this.outputChannel.appendLine('Received stderr data');
            errorOutput += data;
            this.testOutputChannel.append(data);
        });

        child.on('close', async (code) => {
            this.outputChannel.appendLine(`Test process closed with code: ${code}`);
            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();
            const testResults = this.parseTestResults(output);

            // Update status bar
            if (code === 0) {
                this.statusBarItem.text = `$(check) Tests: ${testResults.passed} passed`;
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBar.background');
            } else {
                this.statusBarItem.text = `$(error) Tests: ${testResults.failed} failed, ${testResults.passed} passed`;
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            }

            const metadata: TestRunMetadata = {
                timestamp: new Date().toISOString(),
                projectInfo: this.projectInfo,
                environment: {
                    nodeVersion: process.version,
                    vscodeVersion: vscode.version,
                    platform: process.platform,
                    osInfo: await getSystemInfo(),
                    workspace: {
                        name: workspaceFolders[0].name,
                        path: workspacePath,
                        gitInfo: this.gitInfo
                    }
                },
                testRunner: this.testRunnerInfo,
                execution: {
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    duration,
                    exitCode: code || 0
                }
            };

            try {
                await axios.post('https://codeclashserver.onrender.com/test-results', {
                    testResults,
                    metadata,
                    rawOutput: { stdout: output, stderr: errorOutput }
                });
                vscode.window.showInformationMessage('Test results sent successfully!');
            } catch (error) {
                vscode.window.showErrorMessage('Failed to send test results.');
                console.error('Error sending test results:', error);
            }

            this.testOutputChannel.show();
            this.outputChannel.appendLine('Sending test results to API');
        });
    }

    async startWatchMode() {
        if (this.isWatching) {
            return;
        }

        this.isWatching = true;
        this.outputChannel.appendLine('Starting watch mode');
        this.statusBarItem.text = "$(eye) Test Watch Mode";
        this.statusBarItem.show();

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        // Create a file system watcher for test files
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolders[0], '**/*.{test,spec}.{js,ts,jsx,tsx}')
        );

        // Watch for file changes
        this.fileWatcher.onDidChange(async () => {
            this.outputChannel.appendLine('Test file changed, running tests...');
            await this.startTestMonitor();
        });

        // Initial test run
        await this.startTestMonitor();
    }

    async stopWatchMode() {
        this.isWatching = false;
        this.fileWatcher?.dispose();
        this.statusBarItem.text = "$(beaker) Test Monitor";
        this.outputChannel.appendLine('Watch mode stopped');
    }
}