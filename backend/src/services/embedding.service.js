const { spawn } = require('child_process');
const path = require('path');

// Path to the Python script
const PYTHON_SCRIPT_PATH = path.join(__dirname, '../../../python-ml/embed.py');
// Path to the Python executable in the virtual environment
// Assuming the venv is in the project root (../../venv) relative to backend/src/services
// backend/src/services -> backend/src -> backend -> root
const PYTHON_EXEC_PATH = path.join(__dirname, '../../../venv/bin/python');

const generateEmbeddings = (texts) => {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn(PYTHON_EXEC_PATH, [PYTHON_SCRIPT_PATH]);

        let dataString = '';
        let errorString = '';

        pythonProcess.stdout.on('data', (data) => {
            dataString += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorString += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`Python process exited with code ${code}: ${errorString}`));
            }

            try {
                const embeddings = JSON.parse(dataString);
                resolve(embeddings);
            } catch (error) {
                reject(new Error(`Failed to parse Python output: ${error.message}`));
            }
        });

        // Send input data to Python script
        pythonProcess.stdin.write(JSON.stringify(texts));
        pythonProcess.stdin.end();
    });
};

module.exports = {
    generateEmbeddings,
};
