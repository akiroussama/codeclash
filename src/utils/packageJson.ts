import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { join } from 'path';

export async function readPackageJson(workspacePath: string): Promise<any> {
    try {
        const packageJsonPath = join(workspacePath, 'package.json');
        const content = await fs.readFile(packageJsonPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`Failed to read package.json: ${error}`);
    }
}