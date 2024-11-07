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
    private maxOutputLines: number;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.testOutputChannel = vscode.window.createOutputChannel('Test Monitor');
        this.outputChannel = vscode.window.createOutputChannel('Test Monitor Debug');
        this.outputChannel.appendLine('TestMonitorExtension initialized');
        this.maxOutputLines = 1000;
        this.outputChannel.appendLine(`TestMonitorExtension initialized with maxOutputLines: ${this.maxOutputLines}`);
    }

    private appendLineWithLimit(message: string) {
        const content = this.outputChannel.toString();
        const lines = content.split('\n');
        this.outputChannel.appendLine(`Current log lines: ${lines.length}, max: ${this.maxOutputLines}`);
        
        if (lines.length >= this.maxOutputLines) {
            this.outputChannel.clear();
            this.outputChannel.appendLine('--- Previous output truncated ---');
            const keepLines = lines.slice(Math.floor(this.maxOutputLines * 0.8));
            keepLines.forEach(line => this.outputChannel.appendLine(line));
        }
        
        this.outputChannel.appendLine(message);
    }

    async initialize() {
        try {
            this.appendLineWithLimit(`Initializing extension with context: ${JSON.stringify(this.context.extension.id)}`);
            this.username = this.context.globalState.get('username') || '';
            this.appendLineWithLimit(`Retrieved username: ${this.username}`);
            
            if (!this.username) {
                this.username = await this.getGithubUsername();
                this.appendLineWithLimit(`User: ${this.username}`);
            }

            // Set up status bar item
            this.statusBarItem.text = "$(beaker) Clash Of Code";
            this.statusBarItem.command = 'efrei.start';
            this.statusBarItem.tooltip = 'Start clash of code';
            this.statusBarItem.show();
        } catch (error) {
            this.outputChannel.appendLine(`Error in initialize: ${error}`);
            // Set default values even if initialization fails
            this.statusBarItem.text = "$(beaker) Clash of Code";
            this.statusBarItem.show();
        }
    }

    private async getGithubUsername(): Promise<string | undefined> {
        this.outputChannel.appendLine(`Attempting to get GitHub username`);
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
        this.outputChannel.appendLine(`Prompting for username`);
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
        this.outputChannel.appendLine(`Fetching Git info from workspace: ${workspacePath}`);
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

            this.outputChannel.appendLine(`Git info retrieved - Branch: ${branch}, Commit: ${commit}, Remote: ${remote}`);
            return { branch, commit, remote };
        } catch (error) {
            this.outputChannel.appendLine(`Error fetching Git info: ${error}`);
            return undefined;
        }
    }

    private async getProjectInfo(workspacePath: string): Promise<any> {
        this.outputChannel.appendLine(`Fetching project info from workspace: ${workspacePath}`);
        try {
            const packageJson = await readPackageJson(workspacePath, this.outputChannel);
            this.outputChannel.appendLine(`Project info found - Name: ${packageJson.name}, Version: ${packageJson.version}`);
            this.outputChannel.appendLine(`Dependencies count: ${Object.keys(packageJson.dependencies || {}).length}`);
            this.outputChannel.appendLine(`Available scripts: ${Object.keys(packageJson.scripts || {}).join(', ')}`);
            return {
                name: packageJson.name || 'unknown',
                version: packageJson.version || '0.0.0',
                dependencies: packageJson.dependencies || {},
                scripts: packageJson.scripts || {}
            };
        } catch (error) {
            this.outputChannel.appendLine(`Warning: Could not read package.json: ${error}. Using default values.`);
            return {
                name: 'unknown',
                version: '0.0.0',
                dependencies: {},
                scripts: {}
            };
        }
    }

    private async getTestRunnerInfo(workspacePath: string): Promise<any> {
        this.outputChannel.appendLine(`Fetching test runner info from workspace: ${workspacePath}`);
        let testRunner = 'unknown';
        let version = '';
        let config = {};
    
        const packageJson = await readPackageJson(workspacePath, this.outputChannel);
        try {
            this.outputChannel.appendLine(`Package.json dependencies: ${JSON.stringify(packageJson.dependencies)}`);
            this.outputChannel.appendLine(`Package.json devDependencies: ${JSON.stringify(packageJson.devDependencies)}`);
    
            if (packageJson.dependencies?.vitest || packageJson.devDependencies?.vitest) {
                testRunner = 'vitest';
                version = packageJson.dependencies?.vitest || packageJson.devDependencies?.vitest;
            }
        } catch (error) {
            this.outputChannel.appendLine(`Warning: Could not read package.json: ${error}. Using default values.`);
            return { name: 'unknown', version: '', config: {} };
        }

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

    private parseTestResultsV3(output: string): TestResult {
        this.outputChannel.appendLine(`Parsing test results V3`);
        this.outputChannel.appendLine(`Raw output length: ${output.length} characters`);
        
        const results: TestResult = {
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            total: 0,
            testFiles: [],
            failureDetails: []
        };

        // Remove ANSI escape codes
        const cleanOutput = output.replace(/\x1b$[0-9;]*m/g, '');
        this.outputChannel.appendLine(`Cleaned output length: ${cleanOutput.length} characters`);

        // Parse test files and their status for Vitest
        const fileTestPattern = /([^\s]+\.(?:test|spec)\.[jt]sx?)\s*$\s*(\d+)\s*tests?\s*$/g;
        let fileMatch;
        while ((fileMatch = fileTestPattern.exec(cleanOutput)) !== null) {
            results.testFiles.push(fileMatch[1]);
        }

        // Parse overall test results for Vitest
        const failedPattern = /(\d+)\s*failed/;
        const passedPattern = /(\d+)\s*passed/;
        const totalPattern = /Tests\s*(\d+)\s*failed\s*\|\s*(\d+)\s*passed\s*$(\d+)$/;

        const failedMatch = cleanOutput.match(failedPattern);
        const passedMatch = cleanOutput.match(passedPattern);
        const totalMatch = cleanOutput.match(totalPattern);

        if (failedMatch) {
            results.failed = parseInt(failedMatch[1]);
        }

        if (passedMatch) {
            results.passed = parseInt(passedMatch[1]);
        }

        if (totalMatch) {
            results.total = parseInt(totalMatch[3]);
        } else {
            // If total is not directly available, calculate it
            results.total = results.failed + results.passed;
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

        this.outputChannel.appendLine(`Parsed results V3: ${JSON.stringify(results, null, 2)}`);
        this.outputChannel.appendLine(`Test files found: ${results.testFiles.length}`);
        this.outputChannel.appendLine(`Failure details found: ${results.failureDetails.length}`);
        return results;
    }

    private parseTestResultsV2(output: string): TestResult {
        this.outputChannel.appendLine(`Parsing test results v2`);
        const results: TestResult = {
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            total: 0,
            testFiles: [],
            failureDetails: []
        };
    
        // Clean ANSI escape codes from the output
        const cleanOutput = output.replace(/\x1b\[\d+m/g, '');
    
        // Parse test files
        const fileTestPattern = /✓\s+([\w./]+\.(?:test|spec)\.[jt]sx?)\s*\((\d+)\s*tests?\)/;
        const fileMatch = cleanOutput.match(fileTestPattern);
        if (fileMatch) {
            results.testFiles.push(fileMatch[1]);
        }
    
        // Parse total passed tests
        const passedPattern = /Tests\s+(\d+)\s+passed\s*\((\d+)\)/;
        const passedMatch = cleanOutput.match(passedPattern);
        if (passedMatch) {
            results.passed = parseInt(passedMatch[1]);
            results.total = parseInt(passedMatch[2]);
        }
    
        // Parse duration
        const durationPattern = /Duration\s+(\d+)ms/;
        const durationMatch = cleanOutput.match(durationPattern);
        if (durationMatch) {
            results.duration = parseInt(durationMatch[1]) / 1000; // Convert to seconds
        }
        this.outputChannel.appendLine(`Parsed results V2: ${JSON.stringify(results, null, 2)}`);
        return results;
    }
    private parseTestResults(output: string): TestResult {
        this.outputChannel.appendLine(`Parsing test results`);
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
        this.outputChannel.appendLine(`Parsed results V1: ${JSON.stringify(results, null, 2)}`);
        return results;
    }

    private async sendTestStatusUpdate(testResults: TestResult, startTime: Date) {
        this.outputChannel.appendLine(`Preparing to send test status update at ${new Date().toISOString()}`);
        this.outputChannel.appendLine(`Test results: ${JSON.stringify(testResults, null, 2)}`);
        this.outputChannel.appendLine(`Project info: ${JSON.stringify(this.projectInfo, null, 2)}`);
        this.outputChannel.appendLine(`Git info: ${JSON.stringify(this.gitInfo, null, 2)}`);
        this.outputChannel.appendLine(`Test runner info: ${JSON.stringify(this.testRunnerInfo, null, 2)}`);
        
        if (!testResults.total) {
            this.outputChannel.appendLine(`No test results to send - Skipping update`);
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
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            this.outputChannel.appendLine(`Starting test monitor at ${new Date().toISOString()}`);
            
            if (!workspaceFolders) {
                this.outputChannel.appendLine(`No workspace folders found - Aborting`);
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }
    
            const workspacePath = workspaceFolders[0].uri.fsPath;
            
            // Check for package.json first
            try {
                await readPackageJson(workspacePath, this.outputChannel);
            } catch (error) {
                vscode.window.showErrorMessage('No package.json found. Please initialize a Node.js project first.');
                this.outputChannel.appendLine(`Error: ${error}`);
                return;
            }
            const startTime = new Date();

            // Update status bar
            this.statusBarItem.text = this.isWatching ? 
                "$(sync~spin) Running tests (Watch Mode)..." :
                "$(sync~spin) Running tests...";
            this.statusBarItem.show();

            try {
                this.gitInfo = await this.getGitInfo(workspacePath);
            } catch (error) {
                this.outputChannel.appendLine(`Error getting git info: ${error}`);
                this.gitInfo = { branch: 'unknown', commit: 'unknown', remote: 'unknown' };
            }

            try {
                this.projectInfo = await this.getProjectInfo(workspacePath);
            } catch (error) {
                this.outputChannel.appendLine(`Error getting project info: ${error}`);
                this.projectInfo = { name: 'unknown', version: '0.0.0', dependencies: {}, scripts: {} };
            }

            try {
                this.testRunnerInfo = await this.getTestRunnerInfo(workspacePath);
            } catch (error) {
                this.outputChannel.appendLine(`Error getting test runner info: ${error}`);
                this.testRunnerInfo = { name: 'unknown', version: '', config: {} };
            }

            let output = '';
            let errorOutput = '';

            const child = exec('npm run test', { cwd: workspacePath });

            child.stdout?.on('data', (data) => {
                try {
                    this.outputChannel.appendLine(`Received stdout data at ${new Date().toISOString()}`);
                    output += data;
                    this.testOutputChannel.append(data);
                    this.outputChannel.appendLine(` ######## data ######## : ${data}`);
                    let testResults = this.parseTestResults(data);
                    if (!testResults.total) {
                        testResults = this.parseTestResultsV2(data);
                        if (!testResults.total) {
                            testResults = this.parseTestResultsV3(data);
                        }
                    }
                    this.sendTestStatusUpdate(testResults, startTime).catch(error => {
                        this.outputChannel.appendLine(`Error sending test status update: ${error}`);
                    });
                } catch (error) {
                    this.outputChannel.appendLine(`Error processing stdout data: ${error}`);
                }
            });

            child.stderr?.on('data', (data) => {
                try {
                    this.outputChannel.appendLine(`Received stderr data: ${data}`);
                    errorOutput += data;
                    this.testOutputChannel.append(data);
                } catch (error) {
                    this.outputChannel.appendLine(`Error processing stderr data: ${error}`);
                }
            });

            child.on('close', async (code) => {
                try {
                    this.outputChannel.appendLine(`Test process closed with code: ${code}`);
                    const endTime = new Date();
                    const duration = endTime.getTime() - startTime.getTime();
                    const testResults = this.parseTestResults(output);

                    this.updateStatusBar(testResults);

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
                        this.outputChannel.appendLine(`Error sending test results: ${error}`);
                        vscode.window.showErrorMessage('Failed to send test results.');
                    }
                } catch (error) {
                    this.outputChannel.appendLine(`Error in close handler: ${error}`);
                    this.updateStatusBar({ passed: 0, failed: 0, skipped: 0, duration: 0, total: 0, testFiles: [], failureDetails: [] });
                }
            });
        } catch (error) {
            this.outputChannel.appendLine(`Error in startTestMonitor: ${error}`);
            this.statusBarItem.text = "$(error) Test Run Failed";
            this.statusBarItem.show();
            vscode.window.showErrorMessage('Failed to start test monitor');
        }
    }

    async startWatchMode() {
        if (this.isWatching) {
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        // Create a file system watcher for relevant files
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            '**/*.{js,jsx,ts,tsx}',  // Watch JavaScript and TypeScript files
            false,  // Don't ignore creates
            false,  // Don't ignore changes
            false   // Don't ignore deletes
        );

        // Listen to file save events
        this.fileWatcher.onDidChange(async (uri) => {
            // Wait a brief moment to ensure file is fully saved
            await new Promise(resolve => setTimeout(resolve, 500));
            this.outputChannel.appendLine(`File changed: ${uri.fsPath}`);
            await this.startTestMonitor();
        });

        this.isWatching = true;
        this.statusBarItem.text = "$(eye) Test Watch Mode Active";
        this.statusBarItem.show();
        vscode.window.showInformationMessage('Test watch mode started');
    }

    stopWatchMode() {
        if (!this.isWatching) {
            return;
        }
    
        this.fileWatcher?.dispose();
        this.isWatching = false;
        this.statusBarItem.text = "$(beaker) Run Tests";
        this.statusBarItem.show();
        vscode.window.showInformationMessage('Test watch mode stopped');
    }

    private updateStatusBar(testResults: TestResult) {
        try {
            this.outputChannel.appendLine(`Updating status bar with results: ${JSON.stringify(testResults, null, 2)}`);
            if (!testResults.total) {
                this.statusBarItem.text = "$(beaker) No tests run";
                return;
            }

            const passRate = Math.round((testResults.passed / testResults.total) * 100);
            
            if (testResults.failed > 0) {
                this.statusBarItem.text = `$(error) Tests: ${testResults.failed} failed, ${testResults.passed} passed (${passRate}%)`;
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                this.statusBarItem.tooltip = `Failed: ${testResults.failed}\nPassed: ${testResults.passed}\nSkipped: ${testResults.skipped}\nDuration: ${testResults.duration}s`;
            } else {
                this.statusBarItem.text = `$(check) Tests: ${testResults.passed} passed (${passRate}%)`;
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.background');
                this.statusBarItem.tooltip = `All tests passed!\nTotal: ${testResults.total}\nDuration: ${testResults.duration}s`;
            }

            this.statusBarItem.show();
        } catch (error) {
            this.outputChannel.appendLine(`Error updating status bar: ${error}`);
            this.statusBarItem.text = "$(warning) Status Update Error";
            this.statusBarItem.show();
        }
    }
}