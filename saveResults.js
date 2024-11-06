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
const saveResults = async () => {
    const executions = report.run.executions;

    // Loop through each execution
    for (const exec of executions) {
        const endpoint = exec.item.name;
        const status_code = exec.response.code;
        const response_time = exec.response.responseTime;
        const test_status = exec.assertions.every(a => a.error === undefined) ? 'PASSED' : 'FAILED';

        const resultQuery = `
          INSERT INTO api_test_results (endpoint, status_code, response_time, test_status)
          VALUES (?, ?, ?, ?)
        `;

        try {
            // Insert main result into api_test_results and get the inserted ID
            const [result] = await connection.promise().query(resultQuery, [endpoint, status_code, response_time, test_status]);
            const resultId = result.insertId;

            // Prepare insert queries for each assertion as an array of promises
            const assertionPromises = exec.assertions.map(assertion => {
                const test_name = assertion.assertion;
                const assertion_status = assertion.error === undefined ? 'PASSED' : 'FAILED';
                const error_message = assertion.error ? assertion.error.message : null;

                const assertionQuery = `
                  INSERT INTO api_test_assertions (result_id, test_name, test_status, error)
                  VALUES (?, ?, ?, ?)
                `;

                // Return a promise for each assertion insert
                return connection.promise().query(assertionQuery, [resultId, test_name, assertion_status, error_message]);
            });

            // Wait for all assertion insertions to complete
            await Promise.all(assertionPromises);

            console.log(`Result for ${endpoint} saved with status: ${test_status}, and all assertions recorded.`);
        } catch (error) {
            console.error('Error inserting data:', error);
        }
    }

    connection.end(); // Close the connection only after all queries are complete
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
