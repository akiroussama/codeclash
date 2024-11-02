const vscode = require('vscode');
const { exec } = require('child_process');
const axios = require('axios');

function activate(context: any) {
  // Retrieve stored username or prompt for it
  let username = context.globalState.get('username');
  if (!username) {
    vscode.window.showInputBox({ prompt: 'Enter your username' }).then((input:any) => {
      if (input) {
        username = input;
        context.globalState.update('username', username);
      } else {
        vscode.window.showErrorMessage('Username is required to use this extension.');
        return;
      }
    });
  }

  let disposable = vscode.commands.registerCommand('extension.runTests', function () {
    if (!username) {
      vscode.window.showErrorMessage('Username is required to run tests.');
      return;
    }

    // Run the test command
    exec('npm run test', (error: any, stdout: any, stderr: any) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }

      // Parse the test results from stdout
      const testResults = parseTestResults(stdout, username);

      // Send the results to the backend
      axios.post('https://codeclashserver.onrender.com/test-results', {
        data: testResults,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development', // Additional metadata
        vscodeVersion: vscode.version, // VSCode version
        platform: process.platform // OS platform
      })
        .then((response: any) => {
          vscode.window.showInformationMessage('Test results sent successfully!');
        })
        .catch((error: any) => {
          vscode.window.showErrorMessage('Failed to send test results.');
          console.error(error);
        });
    });
  });
  context.subscriptions.push(disposable);
}

function parseTestResults(output: any, username: string) {
  // Implement logic to parse the test results from the output
  const passed = (output.match(/✓/g) || []).length;
  const failed = (output.match(/✗/g) || []).length;
  
  // Extract additional information such as test names and durations
  const testDetails = output.split('\n').map((line:any) => {
    const match = line.match(/(✓|✗)\s+(.+?)\s+\((\d+ms)\)/);
    return match ? { status: match[1], name: match[2], duration: match[3] } : null;
  }).filter(Boolean);

  const date = new Date().toISOString().split('T')[0]; // Current date in YYYY-MM-DD format

  return { username, date, passed, failed, testDetails };
}

exports.activate = activate;