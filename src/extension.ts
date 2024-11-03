import * as vscode from 'vscode';
import { exec } from 'child_process';
import axios from 'axios';
import * as os from 'os';
import { getSystemInfo } from './systemInfo';
import { readPackageJson } from './utils/packageJson';
interface TestResult  
 {
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  total?: number;
  testFiles: string[];
  failureDetails: Array<{
    testName: string;
    error: string;
    duration?: number;
  }>;
}

interface TestRunMetadata {
  timestamp: string;
  projectInfo: {
    name: string;
    version: string;
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
  environment: {
    nodeVersion: string;
    vscodeVersion: string;
    platform: string;
    osInfo: {
      platform: string;
      release: string;
      arch: string;
      memory: {
        total: number;
        free: number;
      };
      cpus: {
        model: string;
        speed: number;
        cores: number;
      };
    };
    workspace: {
      name: string;
      path: string;
      gitInfo?: {
        branch: string;
        commit: string;
        remote: string;
      };
    };
  };
  testRunner: {
    name: string;
    version: string;
    config: any;
  };
  execution: {
    startTime: string;
    endTime: string;
    duration: number;
    exitCode: number;
  };
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('Extension activated');
    let statusBarItem: vscode.StatusBarItem;
    let testOutputChannel: vscode.OutputChannel;

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    testOutputChannel = vscode.window.createOutputChannel('Test Monitor');

    async function getGitInfo(workspacePath: string): Promise<any> {
        console.log('Fetching Git info');
        try {
            const branch = await new Promise((resolve) => {
                exec('git rev-parse --abbrev-ref HEAD', { cwd: workspacePath }, (err, stdout) => {
                    resolve(err ? '' : stdout.trim());
                });
            });

            const commit = await new Promise((resolve) => {
                exec('git rev-parse HEAD', { cwd: workspacePath }, (err, stdout) => {
                    resolve(err ? '' : stdout.trim());
                });
            });

            const remote = await new Promise((resolve) => {
                exec('git remote get-url origin', { cwd: workspacePath }, (err, stdout) => {
                    resolve(err ? '' : stdout.trim());
                });
            });

            console.log('Git info fetched:', { branch, commit, remote });
            return { branch, commit, remote };
        } catch (error) {
            console.error('Error fetching Git info:', error);
            return undefined;
        }
    }

    async function getProjectInfo(workspacePath: string): Promise<any> {
        console.log('Fetching project info');
        try {
            const packageJson = await readPackageJson(workspacePath);
            console.log('Project info fetched:', packageJson);
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

    async function getTestRunnerInfo(workspacePath: string): Promise<any> {
        console.log('Fetching test runner info');
        const packageJson = await readPackageJson(workspacePath);
        let testRunner = 'unknown';
        let version = '';
        let config = {};

        if (packageJson.dependencies?.jest || packageJson.devDependencies?.jest) {
            testRunner = 'jest';
            const jestConfig = await import(`${workspacePath}/jest.config.js`).catch(() => ({}));
            config = jestConfig;
            version = packageJson.dependencies?.jest || packageJson.devDependencies?.jest;
        } else if (packageJson.dependencies?.mocha || packageJson.devDependencies?.mocha) {
            testRunner = 'mocha';
            version = packageJson.dependencies?.mocha || packageJson.devDependencies?.mocha;
        }

        console.log('Test runner info fetched:', { name: testRunner, version, config });
        return { name: testRunner, version, config };
    }

    let disposable = vscode.commands.registerCommand('test-monitor.start', async () => {
        console.log('Command test-monitor.start triggered');
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        const startTime = new Date();
        
        statusBarItem.text = "$(sync~spin) Running tests...";
        statusBarItem.show();

        console.log('Fetching system info');
        const systemInfo = await getSystemInfo();
        console.log('System info:', systemInfo);

        const gitInfo = await getGitInfo(workspacePath);
        const projectInfo = await getProjectInfo(workspacePath);
        const testRunnerInfo = await getTestRunnerInfo(workspacePath);

        console.log('Starting test process');
        const child = exec('npm run test', {
            cwd: workspacePath
        });

        let output = '';
        let errorOutput = '';

        child.stdout?.on('data', (data) => {
            console.log('stdout:', data);
            output += data;
            testOutputChannel.append(data);

            // Send real-time test status
            const testResults = parseTestResults(output);
            sendTestStatusUpdate(testResults);
        });

        child.stderr?.on('data', (data) => {
            console.log('stderr:', data);
            errorOutput += data;
            testOutputChannel.append(data);

            // Send real-time test status
            const testResults = parseTestResults(output);
            sendTestStatusUpdate(testResults);
        });

        child.on('error', (err) => {
            console.error('Failed to start subprocess:', err);
        });

        child.on('close', async (code) => {
            console.log('Process closed with code:', code);
            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();

            console.log('Parsing test results');
            const testResults = parseTestResults(output);
            console.log('Test results:', testResults);
            
            // Update status bar
            if (code === 0) {
                statusBarItem.text = `$(check) Tests: ${testResults.passed} passed`;
                statusBarItem.backgroundColor = new vscode.ThemeColor('statusBar.background');
            } else {
                statusBarItem.text = `$(error) Tests: ${testResults.failed} failed, ${testResults.passed} passed`;
                statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            }

            const metadata: TestRunMetadata = {
                timestamp: new Date().toISOString(),
                projectInfo,
                environment: {
                    nodeVersion: process.version,
                    vscodeVersion: vscode.version,
                    platform: process.platform,
                    osInfo: systemInfo,
                    workspace: {
                        name: workspaceFolders[0].name,
                        path: workspacePath,
                        gitInfo
                    }
                },
                testRunner: testRunnerInfo,
                execution: {
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    duration,
                    exitCode: code || 0
                }
            };

            console.log('Sending test results');
            try {
                await axios.post('http://localhost:3000/test-results', {
                    testResults,
                    metadata,
                    rawOutput: {
                        stdout: output,
                        stderr: errorOutput
                    }
                });
                
                vscode.window.showInformationMessage('Test results sent successfully!');
            } catch (error) {
                vscode.window.showErrorMessage('Failed to send test results.');
                console.error('Error sending test results:', error);
            }

            testOutputChannel.show();
        });
    });

    context.subscriptions.push(disposable, statusBarItem, testOutputChannel);
}



function parseTestResults(output: string): TestResult {
    const results: TestResult = {
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        total: 0,
        testFiles: [],
        failureDetails: []
    };

    // Remove ANSI escape codes and clean the output
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
    console.log('Clean test output:', cleanOutput);

    // Parse test files and their status
    const fileTestPattern = /([^\s]+\.(?:test|spec)\.[jt]sx?)\s*\((\d+)\s*tests?\s*\|\s*(\d+)\s*failed\)/g;
    let fileMatch;
    while ((fileMatch = fileTestPattern.exec(cleanOutput)) !== null) {
        results.testFiles.push(fileMatch[1]);
    }

    // Parse overall test results
    const testSummaryPattern = /Tests\s*(\d+)\s*failed\s*\|\s*(\d+)\s*passed\s*\((\d+)\)/;
    const summaryMatch = cleanOutput.match(testSummaryPattern);
    if (summaryMatch) {
        results.failed = parseInt(summaryMatch[1]);
        results.passed = parseInt(summaryMatch[2]);
        results.total = parseInt(summaryMatch[3]);
    }

    // Parse duration
    const durationPattern = /Duration\s*(\d+)ms/;
    const durationMatch = cleanOutput.match(durationPattern);
    if (durationMatch) {
        results.duration = parseInt(durationMatch[1]) / 1000; // Convert to seconds
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

function sendTestStatusUpdate(testResults: TestResult) {
    const statusUpdate = {
        user: 'oakri', // Replace with dynamic user info if available
        timestamp: new Date().getTime().toString(),
        testStatus: JSON.stringify({
            passed: testResults.passed,
            errors: testResults.failed
        })
    };

    axios.post('http://localhost:3000/test-status', statusUpdate)
        .then(() => {
            console.log('Test status update sent successfully');
        })
        .catch((error) => {
            console.error('Error sending test status update:', error);
        });
}

export function deactivate() {}