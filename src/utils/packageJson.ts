import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Reads and parses the package.json file from the given workspace path.
 * Logs detailed debug information to the provided OutputChannel.
 * 
 * @param workspacePath The file system path of the workspace.
 * @param outputChannel The OutputChannel to write logs to.
 * @returns The parsed package.json content.
 * @throws If package.json does not exist or parsing fails.
 */
export async function readPackageJson(workspacePath: string, outputChannel: vscode.OutputChannel): Promise<any> {
    const packageJsonPath = join(workspacePath, 'package.json');

    outputChannel.appendLine(`Attempting to read package.json from: ${packageJsonPath}`);

    try {
        // Check if package.json exists and is accessible
        try {
            await fs.access(packageJsonPath);
            outputChannel.appendLine(`package.json exists at: ${packageJsonPath}`);
        } catch (accessError: any) {
            outputChannel.appendLine(`package.json does not exist or is not accessible at: ${packageJsonPath}`);
            throw new Error(`No package.json found in workspace: ${accessError.message}`);
        }

        // Read file stats
        const stats = await fs.stat(packageJsonPath);
        outputChannel.appendLine('package.json stats:');
        outputChannel.appendLine(`- Size: ${stats.size} bytes`);
        outputChannel.appendLine(`- Is File: ${stats.isFile()}`);
        outputChannel.appendLine(`- Permissions: ${stats.mode.toString(8)}`);

        // Read and parse package.json
        const content = await fs.readFile(packageJsonPath, 'utf8');
        outputChannel.appendLine('package.json content successfully read. Parsing JSON...');
        const packageJson = JSON.parse(content);
        outputChannel.appendLine('package.json parsed successfully.');
        outputChannel.appendLine(`Project Name: ${packageJson.name || 'N/A'}`);
        outputChannel.appendLine(`Version: ${packageJson.version || 'N/A'}`);
        return packageJson;
    } catch (error: any) {
        outputChannel.appendLine(`Error reading package.json: ${error.message}`);
        throw new Error(`Failed to read package.json: ${error.message}`);
    }
}