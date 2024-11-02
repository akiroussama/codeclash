const vscode = require('vscode');
const { exec } = require('child_process');
const axios = require('axios');

function activate(context:any) {
  let disposable = vscode.commands.registerCommand('extension.runTests', function () {
    // Run the test command
    exec('npm run test', (error:any, stdout:any, stderr:any) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }

      // Parse the test results from stdout
      const testResults = parseTestResults(stdout);

      // Send the results to the backend
      axios.post('https://codeclashserver.onrender.com/test-results', testResults)
        .then((response:any) => {
          vscode.window.showInformationMessage('Test results sent successfully!');
        })
        .catch((error:any) => {
          vscode.window.showErrorMessage('Failed to send test results.');
          console.error(error);
        });
    });
  });

  context.subscriptions.push(disposable);
}

function parseTestResults(output:any) {
  // Implement logic to parse the test results from the output
  // This is a placeholder example
  const passed = (output.match(/✓/g) || []).length;
  const failed = (output.match(/✗/g) || []).length;
  return { passed, failed };
}

exports.activate = activate;