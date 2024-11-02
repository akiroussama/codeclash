"use strict";
// const vscode = require('vscode');
// const { exec } = require('child_process');
// const axios = require('axios');
// const { getUsername } = require('./getUsername');
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// async function activate(context: any) {
//   console.log('Extension "CodeClash" is now active!');
//   const name = await getUsername();
//   console.log('Retrieved username:', name);
//  const outputChannel = vscode.window.createOutputChannel('CodeClash');
//   outputChannel.appendLine('Extension "CodeClash" is now active!');
//   // Retrieve stored username or prompt for it
//   let username = context.globalState.get('username') || process.env.USER || process.env.USERNAME;
//   console.log('name V3:', username);
//    let uase;
//   if (!username && !name) {
//     vscode.window.showInputBox({ prompt: 'Enter your username' }).then((input: any) => {
//       if (input) {
//         username = input;
//         context.globalState.update('username', username);
//         console.log('Username updated:', username);
//       } else {
//         vscode.window.showErrorMessage('Username is required to use this extension.');
//         return;
//       }
//     });
//   }
//     let disposable = vscode.commands.registerCommand('extension.runNpmTest', () => {
//     // Command logic here
//     console.log('npm run test triggered');
//     // Add your custom logic for handling the npm test command
//     });
//     context.subscriptions.push(disposable);
// //   let disposable = vscode.commands.registerCommand('codeclash.runTests', function () {
// //     outputChannel.appendLine('Command "codeclash.runTests" executed');
// //     console.log('Command "codeclash.runTests" executed');
// //     if (!username) {
// //       vscode.window.showErrorMessage('Username is required to run tests.');
// //       return;
// //     }
// //     // Run the test command
// //     exec('npm run test', (error: any, stdout: any, stderr: any) => {
// //       console.log('Running tests...');
// //       console.log('stdout:', stdout);
// //       console.log('stderr:', stderr);
// //       if (error) {
// //         console.error(`exec error: ${error}`);
// //         return;
// //       }
// //       // Parse the test results from stdout
// //       const testResults = parseTestResults(stdout, username);
// //       console.log('Parsed test results:', testResults);
// //       // Send the results to the backend
// //       axios.post('http://localhost:3000/test-results', {
// //         data: testResults,
// //         timestamp: new Date().toISOString(),
// //         environment: process.env.NODE_ENV || 'development', // Additional metadata
// //         vscodeVersion: vscode.version, // VSCode version
// //         platform: process.platform // OS platform
// //       })
// //         .then((response: any) => {
// //           vscode.window.showInformationMessage('Test results sent successfully!');
// //         })
// //         .catch((error: any) => {
// //           vscode.window.showErrorMessage('Failed to send test results.');
// //           console.error(error);
// //         });
// //     });
// //   });
// //   context.subscriptions.push(disposable);
// }
// function parseTestResults(output: any, username: string) {
//   // Implement logic to parse the test results from the output
//   const passed = (output.match(/✓/g) || []).length;
//   const failed = (output.match(/✗/g) || []).length;
//   // Extract additional information such as test names and durations
//   const testDetails = output.split('\n').map((line:any) => {
//     const match = line.match(/(✓|✗)\s+(.+?)\s+\((\d+ms)\)/);
//     return match ? { status: match[1], name: match[2], duration: match[3] } : null;
//   }).filter(Boolean);
//   const date = new Date().toISOString().split('T')[0]; // Current date in YYYY-MM-DD format
//   return { username, date, passed, failed, testDetails };
// }
// exports.activate = activate;
const vscode = __importStar(require("vscode"));
function activate(context) {
    console.log('Extension "hello-console" is now active!');
    let disposable = vscode.commands.registerCommand('extension.sayHello', () => {
        vscode.window.showInformationMessage('Hello from your extension!');
    });
    context.subscriptions.push(disposable);
    // Listen for npm run test command
    const terminal = vscode.window.createTerminal('Test Terminal');
    terminal.sendText('npm run test');
    terminal.show();
    vscode.window.onDidCloseTerminal((closedTerminal) => {
        if (closedTerminal.name === 'Test Terminal') {
            console.log('Hello');
        }
    });
}
function deactivate() { }
//# sourceMappingURL=extension.js.map