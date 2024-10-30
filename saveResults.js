const mysql = require('mysql2');
const fs = require('fs');

// Load the report
const reportPath = './newman-report.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// MySQL connection using environment variables
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

connection.connect(err => {
    if (err) {
        console.error('Database connection error:', err);
        return;
    }
    console.log('Connected to MySQL database.');
});

// Function to insert test results into the database
const saveResults = () => {
    const executions = report.run.executions;

    executions.forEach(exec => {
        const endpoint = exec.item.name;
        const status_code = exec.response.code;
        const response_time = exec.response.responseTime;
        const test_status = exec.assertions.every(a => a.error === undefined) ? 'PASSED' : 'FAILED';

        const query = `
      INSERT INTO api_test_results (endpoint, status_code, response_time, test_status)
      VALUES (?, ?, ?, ?)
    `;

        connection.query(query, [endpoint, status_code, response_time, test_status], (error, results) => {
            if (error) {
                console.error('Error inserting data:', error);
            } else {
                console.log(`Result for ${endpoint} saved with status: ${test_status}`);
            }
        });
    });

    connection.end();
};

// Read the report file
fs.readFile(reportPath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading the report file:', err);
        process.exit(1);
    }

    console.log('Report file content:', data); // Log the content

    // Parse the JSON data
    try {
        const report = JSON.parse(data);
        // Continue processing the report...
    } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
        process.exit(1);
    }
});

// Run the save function
saveResults();
