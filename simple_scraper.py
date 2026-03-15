#!/usr/bin/env python3
import requests
from bs4 import BeautifulSoup
import mysql.connector
from mysql.connector import Error
import re
import os
import time

# Configuration
def load_env():
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
    cursor = connection.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS courses_simple (
            id INT PRIMARY KEY,
            lvnr VARCHAR(20),
            typ VARCHAR(10),
            title VARCHAR(500),
            professors TEXT,
            times VARCHAR(500),
            link VARCHAR(500),
            semester VARCHAR(10),
            UNIQUE KEY unique_course_semester (id, semester)
        )
    """)
    connection.commit()
    print("✓ Table 'courses_simple' ready")

def clean_url(url):
    if not url: return url
    return re.sub(r';jsessionid=[A-Z0-9]+\.app-campus\d*', '', url)

def scrape_semester(semester, connection):
    url = f"{BASE_URL}?semester={semester}"
    print(f"Scraping semester {semester}...")
    
    try:
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        rows = soup.find_all('tr', class_=['bg1', 'bg2'])
        courses = []
        
        for row in rows:
            cells = row.find_all('td', recursive=False)
            if len(cells) < 3: continue
            
            link_tag = cells[0].find('a')
            if not link_tag: continue
            
            lvnr = link_tag.get_text(strip=True)
            href = link_tag.get('href', '')
            if not href.startswith('http'):
                href = f"https://campus.aau.at{href}"
            link = clean_url(href)
            
            # Extract numerical ID from URL
            id_match = re.search(r'/course/(\d+)$', link)
            if not id_match: continue
            course_id = int(id_match.group(1))
            
            typ = cells[1].get_text(strip=True)
            
            title_bold = cells[2].find('b')
            title = title_bold.get_text(strip=True) if title_bold else cells[2].get_text(strip=True)
            
            # Professors
            instructors = []
            for a in row.find_all('a', href=lambda h: h and 'visitenkarte' in h):
                instructors.append(a.get_text(strip=True))
            professors = ", ".join(instructors)
            
            # Times
            times = ""
            for td in cells:
                if 'nowrap' in td.get('style', ''):
                    text = td.get_text(strip=True)
                    if re.search(r'\d{1,2}:\d{2}', text):
                        times = text
                        break
            
            courses.append((course_id, lvnr, typ, title, professors, times, link, semester))
        
        if courses:
            cursor = connection.cursor()
            query = """
                INSERT INTO courses_simple (id, lvnr, typ, title, professors, times, link, semester)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    lvnr=VALUES(lvnr), typ=VALUES(typ), title=VALUES(title),
                    professors=VALUES(professors), times=VALUES(times), link=VALUES(link)
            """
            cursor.executemany(query, courses)
            connection.commit()
            print(f"✓ Saved {len(courses)} courses for {semester}")
            
    except Exception as e:
        print(f"Error scraping {semester}: {e}")

def generate_semesters(since='09W'):
    """Generate semester codes from 'since' up to current (26S), newest first.
    
    Format: YYW (winter) and YYS (summer), e.g. 09W, 10S, 10W, 11S, ...
    """
    import argparse
    since_year = int(since[:2])
    since_season = since[2]
    
    semesters = []
    for year in range(since_year, 27):  # up to 26
        if year == since_year and since_season == 'W':
            semesters.append(f"{year:02d}W")
        else:
            semesters.append(f"{year:02d}S")
            semesters.append(f"{year:02d}W")
    # Add 26S but not 26W (future)
    if since_year <= 26 and '26S' not in semesters:
        semesters.append('26S')
    
    # Remove any semesters before 'since'
    try:
        idx = semesters.index(since)
        semesters = semesters[idx:]
    except ValueError:
        pass
    
    # Newest first
    semesters.reverse()
    return semesters

def main():
    import argparse
    parser = argparse.ArgumentParser(description='AAU Simple Course List Scraper')
    parser.add_argument('--since', default='09W',
                        help='Oldest semester to scrape (default: 09W). Format: YYS or YYW')
    args = parser.parse_args()
    
    semesters = generate_semesters(args.since)
    print(f"Will scrape {len(semesters)} semesters: {semesters[0]} ... {semesters[-1]}")
    
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        create_table(connection)
        
        for sem in semesters:
            scrape_semester(sem, connection)
            time.sleep(1) # Be nice
            
    except Error as e:
        print(f"Database error: {e}")
    finally:
        if 'connection' in locals() and connection.is_connected():
            connection.close()

if __name__ == "__main__":
    main()
