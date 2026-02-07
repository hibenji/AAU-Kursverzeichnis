# AAU Course Browser

A web application to browse and filter courses from the AAU campus, with a Python scraper to keep the database updated.

## Setup

1.  **Database**: Ensure MySQL is running and a database named `aau` exists.
2.  **Environment**: Create a `.env` file in the root directory (based on `.env.example` if available) with your database credentials:
    ```ini
    DB_HOST=localhost
    DB_NAME=aau
    DB_USER=your_user
    DB_PASS=your_password
    ```

## Python Scraper

The scraper fetches course data from campus.aau.at and populates the database.

### Requirements

Install the dependencies:
```bash
pip install -r requirements.txt
```

### Usage

Run the scraper:
```bash
python3 scraper.py
```

Options:
- `--test`: Scrape only the first 10 courses for testing.
- `--limit N`: Limit to N courses.

## Web Application

The PHP application displays the course data.
- `index.php`: Main interface with filtering.
- `course.php`: Detail view for a specific course.
- `api/options.php`: API endpoint for filter options.

Ensure your web server (e.g., Apache/Nginx) is configured to serve the directory.
