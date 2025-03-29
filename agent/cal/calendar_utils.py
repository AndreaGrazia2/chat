"""
Utilità per la gestione delle date e dell'interpretazione nel calendario

Questo modulo fornisce funzioni per:
1. Interpretare espressioni di date in linguaggio naturale
2. Convertire orari in formato standard
3. Calcolare periodi di tempo (questa settimana, mese prossimo, ecc.)
4. Formattare risposte per l'utente
"""
from datetime import datetime, timedelta
import re

def parse_relative_date(date_text, base_date=None):
    """
    Converte espressioni di date relative in date effettive
    
    Args:
        date_text: Testo della data (es. 'domani', 'prossimo lunedì')
        base_date: Data base per il calcolo (default: oggi)
    
    Returns:
        datetime.date: Data calcolata o None se non riconosciuta
    """
    if not date_text:
        return None
        
    if not base_date:
        base_date = datetime.now().date()
    
    # Converti a lowercase per facilitare il matching
    date_text = date_text.lower().strip()
    
    # Formati data standard (YYYY-MM-DD)
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_text):
        return datetime.strptime(date_text, '%Y-%m-%d').date()
    
    # Formati data italiani (DD/MM/YYYY o DD-MM-YYYY)
    if re.match(r'^\d{1,2}[/-]\d{1,2}[/-]\d{4}$', date_text):
        if '/' in date_text:
            return datetime.strptime(date_text, '%d/%m/%Y').date()
        else:
            return datetime.strptime(date_text, '%d-%m-%Y').date()
            
    # Oggi, domani, dopodomani
    if date_text in ['oggi', 'today']:
        return base_date
    elif date_text in ['domani', 'tomorrow']:
        return base_date + timedelta(days=1)
    elif date_text in ['dopodomani', 'after tomorrow']:
        return base_date + timedelta(days=2)
    elif date_text in ['ieri', 'yesterday']:
        return base_date - timedelta(days=1)
    
    # Giorni della settimana
    giorni = {
        'lunedì': 0, 'lunedi': 0, 'monday': 0,
        'martedì': 1, 'martedi': 1, 'tuesday': 1,
        'mercoledì': 2, 'mercoledi': 2, 'wednesday': 2,
        'giovedì': 3, 'giovedi': 3, 'thursday': 3,
        'venerdì': 4, 'venerdi': 4, 'friday': 4,
        'sabato': 5, 'saturday': 5,
        'domenica': 6, 'sunday': 6
    }
    
    # Espressioni come "lunedì", "prossimo lunedì", "lunedì prossimo"
    for giorno, offset in giorni.items():
        if giorno in date_text:
            # Calcola giorni da aggiungere alla data corrente
            giorno_corrente = base_date.weekday()
            if 'prossim' in date_text or 'next' in date_text:
                # Se è specificato "prossimo", vai alla settimana successiva
                giorni_da_aggiungere = offset - giorno_corrente
                if giorni_da_aggiungere <= 0:
                    giorni_da_aggiungere += 7
            else:
                # Altrimenti vai al giorno più vicino
                giorni_da_aggiungere = offset - giorno_corrente
                if giorni_da_aggiungere <= 0:
                    giorni_da_aggiungere += 7
            
            return base_date + timedelta(days=giorni_da_aggiungere)
    
    # Mesi specifici
    mesi = {
        'gennaio': 1, 'january': 1,
        'febbraio': 2, 'february': 2,
        'marzo': 3, 'march': 3,
        'aprile': 4, 'april': 4,
        'maggio': 5, 'may': 5,
        'giugno': 6, 'june': 6,
        'luglio': 7, 'july': 7,
        'agosto': 8, 'august': 8,
        'settembre': 9, 'september': 9,
        'ottobre': 10, 'october': 10,
        'novembre': 11, 'november': 11,
        'dicembre': 12, 'december': 12
    }
    
    # Estrai giorni e mesi
    for mese, numero_mese in mesi.items():
        if mese in date_text:
            # Cerca un numero di giorno
            giorno_match = re.search(r'(\d+)\s+(?:di\s+)?'+mese, date_text)
            if giorno_match:
                giorno = int(giorno_match.group(1))
                anno = base_date.year
                
                # Se il mese è già passato, vai all'anno prossimo
                if numero_mese < base_date.month:
                    anno += 1
                
                try:
                    return datetime(anno, numero_mese, giorno).date()
                except ValueError:
                    # Data non valida
                    return None
    
    # Altre espressioni ('tra una settimana', 'tra due giorni', ecc.)
    match_tra = re.search(r'tra\s+(\d+)\s+(giorn[oi]|settiman[ae]|mes[ei])', date_text)
    if match_tra:
        numero = int(match_tra.group(1))
        unita = match_tra.group(2).lower()
        
        if 'giorn' in unita:
            return base_date + timedelta(days=numero)
        elif 'settiman' in unita:
            return base_date + timedelta(weeks=numero)
        elif 'mes' in unita:
            # Semplificazione: un mese = 30 giorni
            return base_date + timedelta(days=30 * numero)
    
    # Non riconosciuto
    return None

def parse_time(time_text):
    """
    Converte espressioni di orario in formato standard HH:MM
    
    Args:
        time_text: Testo dell'orario (es. '15:00', '3 pm', 'alle 9', 'ore 17')
        
    Returns:
        str: Orario in formato HH:MM o None se non riconosciuto
    """
    if not time_text:
        return None
        
    time_text = time_text.lower().strip()
    
    # Formato HH:MM o H:MM
    time_match = re.match(r'^(\d{1,2}):(\d{2})$', time_text)
    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2))
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return f"{hour:02d}:{minute:02d}"
    
    # Formato solo ora (es. "15", "alle 15", "ore 15")
    hour_match = re.search(r'(?:alle\s+|ore\s+)?(\d{1,2})(?:\s*[h:]?00)?', time_text)
    if hour_match:
        hour = int(hour_match.group(1))
        if 0 <= hour <= 23:
            return f"{hour:02d}:00"
    
    # AM/PM
    am_pm_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)', time_text)
    if am_pm_match:
        hour = int(am_pm_match.group(1))
        minute = int(am_pm_match.group(2) or '0')
        am_pm = am_pm_match.group(3)
        
        if am_pm == 'pm' and hour < 12:
            hour += 12
        elif am_pm == 'am' and hour == 12:
            hour = 0
            
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return f"{hour:02d}:{minute:02d}"
    
    # Espressioni italiane (mezzogiorno, mezzanotte)
    if 'mezzogiorno' in time_text:
        return "12:00"
    if 'mezzanotte' in time_text:
        return "00:00"
    
    # Espressioni come "mattina", "pomeriggio", "sera"
    if 'mattina' in time_text:
        return "09:00"  # Default per la mattina
    if 'pomeriggio' in time_text:
        return "15:00"  # Default per il pomeriggio
    if 'sera' in time_text:
        return "19:00"  # Default per la sera
    
    return None

def get_period_dates(period):
    """
    Restituisce la data di inizio e fine per un periodo
    
    Args:
        period: Periodo (today, tomorrow, this_week, next_week, this_month, future)
        
    Returns:
        tuple: (data_inizio, data_fine) in formato stringa YYYY-MM-DD
    """
    today = datetime.now().date()
    
    if period == 'today':
        return today.isoformat(), today.isoformat()
        
    if period == 'tomorrow':
        tomorrow = today + timedelta(days=1)
        return tomorrow.isoformat(), tomorrow.isoformat()
        
    if period == 'this_week':
        # Lunedì di questa settimana
        start_of_week = today - timedelta(days=today.weekday())
        end_of_week = start_of_week + timedelta(days=6)
        return start_of_week.isoformat(), end_of_week.isoformat()
        
    if period == 'next_week':
        # Lunedì della prossima settimana
        start_of_week = today - timedelta(days=today.weekday()) + timedelta(days=7)
        end_of_week = start_of_week + timedelta(days=6)
        return start_of_week.isoformat(), end_of_week.isoformat()
        
    if period == 'this_month':
        # Primo giorno di questo mese
        start_of_month = today.replace(day=1)
        if today.month == 12:
            end_of_month = today.replace(year=today.year+1, month=1, day=1) - timedelta(days=1)
        else:
            end_of_month = today.replace(month=today.month+1, day=1) - timedelta(days=1)
        return start_of_month.isoformat(), end_of_month.isoformat()
        
    if period == 'future':
        # Eventi dal giorno corrente in poi
        return today.isoformat(), (today + timedelta(days=365)).isoformat()  # Un anno in avanti
    
    # Default: oggi
    return today.isoformat(), today.isoformat()

def format_date_italian(date_obj):
    """
    Formatta una data in italiano
    
    Args:
        date_obj: Oggetto data o stringa ISO
        
    Returns:
        str: Data formattata in italiano
    """
    if isinstance(date_obj, str):
        try:
            date_obj = datetime.fromisoformat(date_obj.split('T')[0])
        except (ValueError, IndexError):
            return date_obj
    
    giorni = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"]
    mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", 
            "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]
    
    giorno_settimana = giorni[date_obj.weekday()]
    giorno = date_obj.day
    mese = mesi[date_obj.month - 1]
    anno = date_obj.year
    
    return f"{giorno_settimana} {giorno} {mese} {anno}"

def format_event_response(event_data, action):
    """
    Formatta una risposta user-friendly in base all'azione eseguita
    
    Args:
        event_data: Dati dell'evento
        action: Azione eseguita (create, update, delete, view)
        
    Returns:
        str: Messaggio formattato
    """
    if action == 'create':
        # Gestione singolo evento creato
        date_str = None
        time_str = None
        
        if isinstance(event_data, dict):
            if 'dataInizio' in event_data:
                date_parts = event_data.get('dataInizio', '').split('T')
                if len(date_parts) > 0:
                    try:
                        date_obj = datetime.fromisoformat(date_parts[0])
                        date_str = format_date_italian(date_obj)
                    except (ValueError, TypeError):
                        date_str = date_parts[0]
                
                if len(date_parts) > 1:
                    time_str = date_parts[1][:5]
            
            title = event_data.get('titolo', 'Evento')
        else:
            title = "Evento"
            
        if not date_str:
            date_str = "data impostata"
        if not time_str:
            time_str = "ora impostata"
            
        return f"✅ Ho creato un nuovo evento: '{title}' per {date_str} alle {time_str}"
               
    elif action == 'update':
        if isinstance(event_data, dict):
            title = event_data.get('titolo', 'Evento')
        else:
            title = "Evento"
            
        return f"✅ Ho aggiornato l'evento: '{title}'"
        
    elif action == 'delete':
        return f"✅ Ho eliminato l'evento specificato"
        
    elif action == 'view':
        if not event_data or len(event_data) == 0:
            return "Non ho trovato eventi nel periodo specificato."
            
        if isinstance(event_data, list) and len(event_data) == 1:
            event = event_data[0]
            
            # Estrai e formatta data e ora
            date_str = None
            time_str = None
            
            if 'dataInizio' in event:
                date_parts = event.get('dataInizio', '').split('T')
                if len(date_parts) > 0:
                    try:
                        date_obj = datetime.fromisoformat(date_parts[0])
                        date_str = format_date_italian(date_obj)
                    except (ValueError, TypeError):
                        date_str = date_parts[0]
                
                if len(date_parts) > 1:
                    time_str = date_parts[1][:5]
            
            title = event.get('titolo', 'Evento')
            
            if not date_str:
                date_str = "data non specificata"
            if not time_str:
                time_str = "ora non specificata"
                
            return f"Ho trovato un evento:\n" \
                   f"- {title} il {date_str} alle {time_str}"
                   
        elif isinstance(event_data, list):
            result = f"Ho trovato {len(event_data)} eventi:\n"
            
            for i, event in enumerate(event_data[:5], 1):
                # Estrai e formatta data e ora
                date_str = None
                time_str = None
                
                if 'dataInizio' in event:
                    date_parts = event.get('dataInizio', '').split('T')
                    if len(date_parts) > 0:
                        try:
                            date_obj = datetime.fromisoformat(date_parts[0])
                            date_str = format_date_italian(date_obj)
                        except (ValueError, TypeError):
                            date_str = date_parts[0]
                    
                    if len(date_parts) > 1:
                        time_str = date_parts[1][:5]
                
                title = event.get('titolo', 'Evento')
                
                if not date_str:
                    date_str = "data non specificata"
                if not time_str:
                    time_str = "ora non specificata"
                    
                result += f"{i}. {title} il {date_str} alle {time_str}\n"
                
            if len(event_data) > 5:
                result += f"...e altri {len(event_data) - 5} eventi."
                
            return result
        else:
            return "Informazioni sugli eventi non disponibili."
    
    return "Operazione completata."

# Test delle funzioni (solo per sviluppo)
if __name__ == "__main__":
    # Test parse_relative_date
    test_dates = [
        "oggi", "domani", "lunedì", "prossimo martedì", 
        "15 marzo", "2023-12-25", "15/04/2023"
    ]
    
    print("=== Test parse_relative_date ===")
    for date_text in test_dates:
        result = parse_relative_date(date_text)
        print(f"{date_text} -> {result}")
        
    # Test parse_time
    test_times = [
        "15:00", "9:30", "alle 14", "ore 17", "3 pm", "12:00", "mezzogiorno"
    ]
    
    print("\n=== Test parse_time ===")
    for time_text in test_times:
        result = parse_time(time_text)
        print(f"{time_text} -> {result}")
        
    # Test get_period_dates
    test_periods = [
        "today", "tomorrow", "this_week", "next_week", "this_month", "future"
    ]
    
    print("\n=== Test get_period_dates ===")
    for period in test_periods:
        start, end = get_period_dates(period)
        print(f"{period} -> {start} to {end}")