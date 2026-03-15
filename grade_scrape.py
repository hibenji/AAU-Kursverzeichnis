import json
import requests
import time
from concurrent.futures import ThreadPoolExecutor
import urllib3

# Warnungen für verify=False unterdrücken
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- KONFIGURATION ---
INPUT_FILE = 'aau_kurse_23W_alle.json'
OUTPUT_FILE = 'aau_kurse_23W_alle_noten.json'
EP_KEY = "1697676"
API_TEMPLATE = "https://student-cockpit-backend.aau.at/achievements/statistics?rlvKey={lvnr}&epKey={ep_key}"
COOKIE_STRING = "" 

MAX_THREADS = 8 

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Cookie": COOKIE_STRING
}

def get_course_data(course):
    """Holt Daten und bereinigt sie sofort."""
    lvnr_id = course['nr']
    target_url = API_TEMPLATE.format(lvnr=lvnr_id, ep_key=EP_KEY)
    
    try:
        response = requests.get(target_url, headers=HEADERS, timeout=10, verify=False)
        if response.status_code == 200:
            api_data = response.json()
            
            # --- BEREINIGUNG ---
            # Wir entfernen die Felder direkt aus dem 'api_data' Dictionary
            api_data.pop("examiner", None)
            api_data.pop("hkey", None)
            api_data.pop("grade", None)
            
            print(f"Erfolg & Bereinigt: {lvnr_id}")
            return {
                "nr": lvnr_id,
                "lvnr": course['lvnr'],
                "link": course['link'],
                "data": api_data
            }
        else:
            print(f"Fehler {response.status_code} bei {lvnr_id}")
    except Exception as e:
        print(f"Exception bei {lvnr_id}: {e}")
    return None

def fetch_statistics_multithreaded():
    try:
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            courses = json.load(f)
    except FileNotFoundError:
        print(f"Fehler: {INPUT_FILE} nicht gefunden!")
        return

    print(f"Starte parallele Abfrage für {len(courses)} Kurse...")
    
    with ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
        # map führt die Funktion für jeden Kurs aus
        responses = list(executor.map(get_course_data, courses))
    
    # Filtere fehlgeschlagene Anfragen (None) heraus
    results = [r for r in responses if r is not None]

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\nFertig! {len(results)} bereinigte Einträge gespeichert.")

if __name__ == "__main__":
    start_time = time.time()
    fetch_statistics_multithreaded()
    print(f"Dauer: {round(time.time() - start_time, 2)} Sekunden.")