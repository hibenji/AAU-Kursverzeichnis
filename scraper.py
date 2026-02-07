#!/usr/bin/env python3
"""
AAU Campus Course Scraper
Scrapes courses from campus.aau.at including detail pages
"""

import requests
from bs4 import BeautifulSoup
import mysql.connector
from mysql.connector import Error
import re
import time
import argparse
import os
from datetime import datetime


# Configuration
def load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    # Try current directory too if not found (for dev)
    if not os.path.exists(env_path):
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
        
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                try:
                    key, value = line.split('=', 1)
                    if key.strip() not in os.environ:
                        os.environ[key.strip()] = value.strip()
                except ValueError:
                    continue

load_env()

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'aau'),
    'password': os.getenv('DB_PASS', 'password'),
    'database': os.getenv('DB_NAME', 'aau')
}


BASE_URL = "https://campus.aau.at/studien/lvliste.jsp"


def create_table(connection):
    """Create the courses table"""
    cursor = connection.cursor()
    cursor.execute("DROP TABLE IF EXISTS courses")
    cursor.execute("""
        CREATE TABLE courses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            course_code VARCHAR(20) NOT NULL,
            course_type VARCHAR(10),
            course_name VARCHAR(500),
            course_url VARCHAR(500),
            instructors TEXT,
            schedule_day VARCHAR(50),
            schedule_time VARCHAR(50),
            schedule_location VARCHAR(100),
            
            -- Detail fields from course page
            lv_modell VARCHAR(100),
            semesterstunden VARCHAR(100),
            ects VARCHAR(100),
            organisationseinheit TEXT,
            unterrichtssprache VARCHAR(100),
            anmeldefrist_beginn DATETIME,
            anmeldefrist_ende DATETIME,
            lv_beginn DATE,
            lv_beschreibung TEXT,
            pruefungsinformationen TEXT,
            
            semester VARCHAR(10),
            scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_course_semester (course_code, semester)
        )
    """)
    connection.commit()
    print("✓ Database table 'courses' created")


def clean_url(url):
    """Remove jsessionid from URL"""
    if not url:
        return url
    # Remove ;jsessionid=...app-campusN from URL
    return re.sub(r';jsessionid=[A-Z0-9]+\.app-campus\d*', '', url)


def parse_date(date_str):
    """Parse German date string to Python date object
    
    Examples: '02.03.2026', '11.03.2026'
    """
    if not date_str:
        return None
    try:
        # Clean up the string
        date_str = date_str.strip()
        return datetime.strptime(date_str, '%d.%m.%Y').date()
    except ValueError:
        return None


def parse_datetime(datetime_str):
    """Parse German datetime string to Python datetime object
    
    Examples: '31.03.2026  23:59', '06.03.2026 23:59'
    """
    if not datetime_str:
        return None
    try:
        # Clean up whitespace
        datetime_str = ' '.join(datetime_str.split())
        return datetime.strptime(datetime_str, '%d.%m.%Y %H:%M')
    except ValueError:
        return None


def parse_schedule(schedule_text):
    """Parse schedule text into day, time, and location"""
    if not schedule_text:
        return None, None, None
    
    schedule_text = schedule_text.strip()
    location = None
    if ',' in schedule_text:
        parts = schedule_text.rsplit(',', 1)
        schedule_text = parts[0].strip()
        location = parts[1].strip() if len(parts) > 1 else None
    
    day = None
    day_patterns = [
        r'(Montags?)', r'(Dienstags?)', r'(Mittwochs?)', 
        r'(Donnerstags?)', r'(Freitags?)', r'(Samstags?)', r'(Sonntags?)'
    ]
    for pattern in day_patterns:
        match = re.search(pattern, schedule_text, re.IGNORECASE)
        if match:
            day = match.group(1)
            break
    
    date_match = re.search(r'(\d{2}\.\d{2}\.\d{4})', schedule_text)
    if date_match:
        if day:
            day = f"{day} {date_match.group(1)}"
        else:
            day = date_match.group(1)
    
    time_val = None
    time_match = re.search(r'(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})', schedule_text)
    if time_match:
        time_val = time_match.group(1)
    
    return day, time_val, location


def get_course_details(course_url):
    """Fetch and parse course detail page"""
    details = {
        'lv_modell': None,
        'semesterstunden': None,
        'ects': None,
        'organisationseinheit': None,
        'unterrichtssprache': None,
        'anmeldefrist_beginn': None,
        'anmeldefrist_ende': None,
        'lv_beginn': None,
        'lv_beschreibung': None,
        'pruefungsinformationen': None
    }
    
    try:
        response = requests.get(course_url, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove all sr-only spans (they contain duplicate label text)
        for span in soup.find_all('span', class_='sr-only'):
            span.decompose()
        
        # Field mapping: dt title -> database field
        field_mapping = {
            'LV-Modell': 'lv_modell',
            'Semesterstunde/n': 'semesterstunden',
            'ECTS-Anrechnungspunkte': 'ects',
            'Organisationseinheit': 'organisationseinheit',
            'Unterrichtssprache': 'unterrichtssprache',
            'LV-Beginn': 'lv_beginn'
        }
        
        # Parse dt/dd pairs
        for dt in soup.find_all('dt'):
            title = dt.get('title', '')
            if title in field_mapping:
                dd = dt.find_next_sibling('dd')
                if dd:
                    value = dd.get_text(strip=True)
                    details[field_mapping[title]] = value if value else None
        
        # Parse Anmeldefrist from alert-box-left divs (they use strong tags for labels)
        for alert_box in soup.find_all('div', class_='alert-box-left'):
            text = alert_box.get_text(separator='\n', strip=True)
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            
            for i, line in enumerate(lines):
                if 'Beginn der Anmeldefrist' in line and i + 1 < len(lines):
                    details['anmeldefrist_beginn'] = parse_datetime(lines[i + 1])
                elif 'Ende der Anmeldefrist' in line and i + 1 < len(lines):
                    details['anmeldefrist_ende'] = parse_datetime(lines[i + 1])
        
        # Convert LV-Beginn to date
        if details['lv_beginn']:
            details['lv_beginn'] = parse_date(details['lv_beginn'])
        
        # Get LV-Beschreibung
        desc_div = soup.find('div', id='card-content-lehrveranstaltungsinhalte')
        if desc_div:
            details['lv_beschreibung'] = desc_div.get_text(strip=True)
        
        # Get Prüfungsinformationen
        pruef_div = soup.find('div', id='card-content-pruefung-infos')
        if pruef_div:
            details['pruefungsinformationen'] = pruef_div.get_text(strip=True)
        
    except Exception as e:
        print(f"  Error fetching details: {e}")
    
    return details


def scrape_courses(semester, limit=None):
    """Scrape courses from AAU campus website
    
    Args:
        semester: Semester code (e.g., '26S')
        limit: Optional limit on number of courses to scrape (for testing)
    """
    url = f"{BASE_URL}?semester={semester}"
    print(f"Fetching course list from: {url}")
    
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    
    soup = BeautifulSoup(response.content, 'html.parser')
    courses = []
    
    rows = soup.find_all('tr', class_=['bg1', 'bg2'])
    total = len(rows)
    
    if limit:
        rows = rows[:limit]
        print(f"Found {total} course rows (limiting to {limit} for testing)")
    else:
        print(f"Found {total} course rows")
    
    for i, row in enumerate(rows):
        cells = row.find_all('td', recursive=False)
        if len(cells) < 3:
            continue
        
        course_link = cells[0].find('a')
        if not course_link:
            continue
            
        course_code = course_link.get_text(strip=True)
        course_url = course_link.get('href', '')
        if course_url and not course_url.startswith('http'):
            course_url = f"https://campus.aau.at{course_url}"
        
        # Clean the URL (remove jsessionid)
        course_url = clean_url(course_url)
        
        if not course_code or '.' not in course_code:
            continue
        
        course_type = cells[1].get_text(strip=True) if len(cells) > 1 else None
        
        course_name = None
        if len(cells) > 2:
            bold = cells[2].find('b')
            if bold:
                course_name = bold.get_text(strip=True)
            else:
                course_name = cells[2].get_text(strip=True)
        
        # Parse schedule
        schedule_day, schedule_time, schedule_location = None, None, None
        for td in cells:
            style = td.get('style', '')
            if 'nowrap' in style:
                text = td.get_text(strip=True)
                if re.search(r'\d{1,2}:\d{2}', text):
                    schedule_day, schedule_time, schedule_location = parse_schedule(text)
                    break
        
        # Find instructors
        instructors = []
        for td in cells:
            for link in td.find_all('a', href=lambda h: h and 'visitenkarte' in h):
                name = link.get_text(strip=True)
                if name and name not in instructors:
                    instructors.append(name)
        
        # Fetch detail page
        print(f"  [{i+1}/{total}] {course_code} - {course_name[:40] if course_name else 'N/A'}...")
        details = get_course_details(course_url)
        
        course = {
            'course_code': course_code,
            'course_type': course_type,
            'course_name': course_name,
            'course_url': course_url,
            'instructors': ', '.join(instructors) if instructors else None,
            'schedule_day': schedule_day,
            'schedule_time': schedule_time,
            'schedule_location': schedule_location,
            'semester': semester,
            **details
        }
        courses.append(course)
        
        # Small delay to be respectful to the server
        time.sleep(0.1)
    
    print(f"✓ Scraped {len(courses)} courses with details")
    return courses


def save_to_database(courses, connection):
    """Save courses to MySQL database"""
    if not courses:
        print("No courses to save")
        return 0
    
    cursor = connection.cursor()
    
    insert_query = """
        INSERT INTO courses (
            course_code, course_type, course_name, course_url, instructors,
            schedule_day, schedule_time, schedule_location,
            lv_modell, semesterstunden, ects, organisationseinheit,
            unterrichtssprache, anmeldefrist_beginn, anmeldefrist_ende,
            lv_beginn, lv_beschreibung, pruefungsinformationen, semester
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON DUPLICATE KEY UPDATE
            course_type = VALUES(course_type),
            course_name = VALUES(course_name),
            course_url = VALUES(course_url),
            instructors = VALUES(instructors),
            schedule_day = VALUES(schedule_day),
            schedule_time = VALUES(schedule_time),
            schedule_location = VALUES(schedule_location),
            lv_modell = VALUES(lv_modell),
            semesterstunden = VALUES(semesterstunden),
            ects = VALUES(ects),
            organisationseinheit = VALUES(organisationseinheit),
            unterrichtssprache = VALUES(unterrichtssprache),
            anmeldefrist_beginn = VALUES(anmeldefrist_beginn),
            anmeldefrist_ende = VALUES(anmeldefrist_ende),
            lv_beginn = VALUES(lv_beginn),
            lv_beschreibung = VALUES(lv_beschreibung),
            pruefungsinformationen = VALUES(pruefungsinformationen),
            scraped_at = CURRENT_TIMESTAMP
    """
    
    inserted = 0
    for course in courses:
        try:
            cursor.execute(insert_query, (
                course['course_code'],
                course['course_type'],
                course['course_name'],
                course['course_url'],
                course['instructors'],
                course['schedule_day'],
                course['schedule_time'],
                course['schedule_location'],
                course['lv_modell'],
                course['semesterstunden'],
                course['ects'],
                course['organisationseinheit'],
                course['unterrichtssprache'],
                course['anmeldefrist_beginn'],
                course['anmeldefrist_ende'],
                course['lv_beginn'],
                course['lv_beschreibung'],
                course['pruefungsinformationen'],
                course['semester']
            ))
            inserted += 1
        except Error as e:
            print(f"Error inserting {course['course_code']}: {e}")
    
    connection.commit()
    print(f"✓ Saved {inserted} courses to database")
    return inserted


def main():
    parser = argparse.ArgumentParser(description='AAU Campus Course Scraper')
    parser.add_argument('--test', action='store_true', 
                        help='Test mode: only scrape first 10 courses')
    parser.add_argument('--limit', type=int, default=None,
                        help='Limit number of courses to scrape')
    args = parser.parse_args()
    
    limit = 10 if args.test else args.limit
    
    print("=" * 60)
    print("AAU Campus Course Scraper (with Detail Pages)")
    if limit:
        print(f"*** TEST MODE: Limiting to {limit} courses ***")
    print("=" * 60)
    
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        print("✓ Connected to MySQL")
    except Error as e:
        print(f"✗ MySQL connection failed: {e}")
        return
    
    try:
        create_table(connection)
        courses = scrape_courses('26S', limit=limit)
        save_to_database(courses, connection)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if connection.is_connected():
            connection.close()
            print("✓ Connection closed")


if __name__ == "__main__":
    main()

