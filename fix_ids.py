#!/usr/bin/env python3
import mysql.connector
from mysql.connector import Error
import re
import os

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

def fix_ids():
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        if connection.is_connected():
            cursor = connection.cursor(dictionary=True)
            
            # Fetch all courses
            cursor.execute("SELECT id, course_url FROM courses")
            rows = cursor.fetchall()
            
            print(f"Found {len(rows)} courses to process.")
            
            updates = []
            for row in rows:
                current_id = row['id']
                url = row['course_url']
                
                # Extract ID from URL: https://campus.aau.at/studium/course/124256
                match = re.search(r'/course/(\d+)$', url)
                if match:
                    new_id = int(match.group(1))
                    if current_id != new_id:
                        updates.append((new_id, current_id))
                else:
                    print(f"Could not extract ID from URL: {url}")

            if not updates:
                print("No IDs need fixing.")
                return

            print(f"Preparing to update {len(updates)} course IDs...")
            
            # We need to be careful with PRIMARY KEY updates.
            # If we update an ID to one that already exists as a temporary ID (like 1, 2, 3), 
            # we might hit collisions.
            # However, since we are moving from 1, 2, 3... to 124xxx, and the current max ID is small,
            # it should be fine if we do them one by one or in a specific order.
            
            # To be safe, we'll use a transaction and update them.
            # If the new ID exists as an old ID that is yet to be updated, we might have issues.
            # Let's check if any new_id is in current_ids.
            current_ids = {row['id'] for row in rows}
            
            # Disable foreign key checks if any, though not expected here
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
            
            fixed_count = 0
            for new_id, old_id in updates:
                try:
                    # Update the ID
                    cursor.execute("UPDATE courses SET id = %s WHERE id = %s", (new_id, old_id))
                    fixed_count += 1
                except Error as e:
                    print(f"Error updating ID {old_id} to {new_id}: {e}")
            
            # Re-enable foreign key checks
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
            
            connection.commit()
            print(f"Successfully updated {fixed_count} course IDs.")
            
            # Update AUTO_INCREMENT to be higher than max ID
            cursor.execute("SELECT MAX(id) as max_id FROM courses")
            result = cursor.fetchone()
            if result and result['max_id']:
                new_auto_inc = result['max_id'] + 1
                cursor.execute(f"ALTER TABLE courses AUTO_INCREMENT = {new_auto_inc}")
                print(f"Updated AUTO_INCREMENT to {new_auto_inc}")

    except Error as e:
        print(f"Database error: {e}")
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

if __name__ == "__main__":
    fix_ids()
