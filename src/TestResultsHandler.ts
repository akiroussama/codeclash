import * as vscode from 'vscode';
import { exec } from 'child_process';
import { TestResult } from './types';

export class TestResultsHandler {
    // Use JSON reporter configuration for common test runners
    private static getTestCommand(runner: string): string {
        switch (runner) {
            case 'vitest':
                return 'vitest --reporter=json';
            case 'jest':
                return 'jest --json';
            case 'mocha':
                return 'mocha --reporter json';
            default:
                return 'npm test';
        }
    }

    static async runTests(workspacePath: string, testRunner: string): Promise<TestResult> {
        return new Promise((resolve, reject) => {
            let jsonOutput = '';
            
            const command = this.getTestCommand(testRunner);
            const child = exec(command, { cwd: workspacePath });

            // Collect JSON output
            child.stdout?.on('data', (data) => {
                jsonOutput += data;
            });

            child.on('close', (code) => {
                try {
                    const results = this.parseJsonResults(jsonOutput, testRunner);
                    resolve(results);
                } catch (error) {
                    // Fallback to watching test process events
                    resolve(this.parseFromProcessEvents(jsonOutput, code));
                }
            });

            // Handle potential errors
            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    private static parseJsonResults(jsonOutput: string, runner: string): TestResult {
        const parsed = JSON.parse(jsonOutput);
        
        switch (runner) {
            case 'vitest':
                return {
                    passed: parsed.passed,
                    failed: parsed.failed,
                    skipped: parsed.skipped,
                    duration: parsed.duration / 1000,
                    total: parsed.total,
                    testFiles: parsed.testFiles,
                    failureDetails: parsed.failureDetails?.map((failure: any) => ({
                        testName: failure.name,
                        error: failure.error?.message || '',
                        duration: failure.duration
                    })) || []
                };
            
            case 'jest':
                return {
                    passed: parsed.numPassedTests,
                    failed: parsed.numFailedTests,
                    skipped: parsed.numPendingTests,
                    duration: parsed.testResults[0]?.perfStats?.duration / 1000 || 0,
                    total: parsed.numTotalTests,
                    testFiles: parsed.testResults.map((result: any) => result.testFilePath),
                    failureDetails: this.extractJestFailures(parsed)
                };

            default:
                throw new Error('Unsupported test runner format');
        }
    }

    private static extractJestFailures(results: any): Array<{testName: string, error: string, duration?: number}> {
        const failures: Array<{testName: string, error: string, duration?: number}> = [];
        
        results.testResults.forEach((testFile: any) => {
            testFile.assertionResults
                .filter((assertion: any) => assertion.status === 'failed')
                .forEach((failure: any) => {
                    failures.push({
                        testName: failure.fullName || failure.title,
                        error: failure.failureMessages.join('\n'),
                        duration: testFile.perfStats?.duration
                    });
                });
        });
        
        return failures;
    }

    private static parseFromProcessEvents(output: string, exitCode: number | null): TestResult {
        // Implement fallback parsing logic here
        const results: TestResult = {
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            total: 0,
            testFiles: [],
            failureDetails: []
        };

        // Basic regex patterns for different test runners
        const patterns = {
            vitest: /(\d+)\s+passed\s*\|\s*(\d+)\s+failed\s*\|\s*(\d+)\s+skipped/,
            jest: /Tests:\s+(\d+)\s+passed,\s*(\d+)\s+failed,\s*(\d+)\s+skipped/,
            mocha: /(\d+)\s+passing[\s\S]*?(\d+)\s+failing/
        };

        // Try each pattern
        for (const pattern of Object.values(patterns)) {
            const match = output.match(pattern);
            if (match) {
                results.passed = parseInt(match[1]) || 0;
                results.failed = parseInt(match[2]) || 0;
                results.skipped = parseInt(match[3]) || 0;
                results.total = results.passed + results.failed + results.skipped;
                break;
            }
        }

        return results;
    }
}