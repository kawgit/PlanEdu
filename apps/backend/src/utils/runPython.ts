import { spawn } from 'child_process';
import path from 'path';

/**
 * Runs a Python script with JSON input and returns JSON output
 * @param scriptPath - Relative path to the Python script from backend/src
 * @param inputData - JSON data to send to the Python script via stdin
 * @returns Promise that resolves with the parsed JSON output
 */
export function runPythonScript<T = any>(
  scriptPath: string,
  inputData: any
): Promise<T> {
  return new Promise((resolve, reject) => {
    // Resolve the absolute path to the Python script
    const absoluteScriptPath = path.resolve(__dirname, scriptPath);
    
    // Spawn Python3 process
    const pythonProcess = spawn('python3', [absoluteScriptPath]);
    
    let stdoutData = '';
    let stderrData = '';
    
    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    // Collect stderr data
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(
          `Python script exited with code ${code}\nStderr: ${stderrData}`
        ));
        return;
      }
      
      // Parse JSON output
      try {
        const result = JSON.parse(stdoutData.trim());
        
        // Check if the result contains an error field
        if (result.error) {
          reject(new Error(`Python script error: ${result.error}`));
          return;
        }
        
        resolve(result);
      } catch (parseError) {
        reject(new Error(
          `Failed to parse JSON output: ${parseError}\nOutput: ${stdoutData}`
        ));
      }
    });
    
    // Handle process errors (e.g., script not found)
    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
    
    // Write input data to stdin
    try {
      const inputJSON = JSON.stringify(inputData);
      pythonProcess.stdin.write(inputJSON);
      pythonProcess.stdin.end();
    } catch (error) {
      reject(new Error(`Failed to write input to Python script: ${error}`));
    }
  });
}

