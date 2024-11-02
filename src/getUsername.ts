const vscode = require('vscode');

async function getUsername() {
  try {
    // Request a session from the GitHub authentication provider
    const session = await vscode.authentication.getSession('github', ['read:user'], { createIfNone: true });

    if (session) {
      // Access the username from the session account information
      const username = session.account.label;
      vscode.window.showInformationMessage(`Logged in as: ${username}`);
      return username;
    } else {
      vscode.window.showErrorMessage('No session found');
    }
  } catch (error:any) {
    vscode.window.showErrorMessage(`Error getting username: ${error.message}`);
  }
}

module.exports = {
  getUsername
};