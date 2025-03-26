"""
Agente calendario - Gestione degli eventi di calendario attraverso comandi in linguaggio naturale

Questo modulo fornisce un agente IA che:
1. Analizza i messaggi degli utenti per rilevare intenti relativi al calendario
2. Elabora date e orari in formato naturale
3. Esegue operazioni CRUD sul calendario (create, read, update, delete)
4. Genera risposte naturali per l'utente
"""
import json
import requests
from datetime import datetime, timedelta

class CalendarAgent:
    def __init__(self, llm, calendar_api_base_url="http://localhost:5000/cal/api"):
        """
        Inizializza l'agente calendario
        
        Args:
            llm: Modello di linguaggio (LangChain)
            calendar_api_base_url: URL base delle API calendario
        """
        self.llm = llm
        self.calendar_api_base_url = calendar_api_base_url
        
        # Import qui per evitare dipendenze circolari
        from calendar_intent import create_calendar_intent_chain, parse_intent_response
        self.intent_chain = create_calendar_intent_chain(llm)
        self.parse_intent_response = parse_intent_response
        
        # Utente di default per le richieste
        self.default_user_id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
    
    def process_message(self, user_input, user_id=None):
        """
        Processa un messaggio dell'utente e determina se è relativo al calendario
        
        Args:
            user_input: Messaggio dell'utente
            user_id: ID dell'utente (opzionale)
            
        Returns:
            dict: Risultato dell'elaborazione con risposta
        """
        if user_id:
            self.default_user_id = user_id
            
        # Analizza l'intento
        raw_intent = self.intent_chain.invoke({"user_input": user_input})
        
        from calendar_intent import parse_intent_response
        intent_data = parse_intent_response(raw_intent)
        
        # Log dell'intento rilevato (per debug)
        print(f"Calendar intent detected: {json.dumps(intent_data, indent=2)}")
        
        # Se non è un intento calendario, ritorna subito
        if not intent_data.get('is_calendar_intent', False):
            return {
                "is_calendar_intent": False,
                "response": None,
                "reasoning": intent_data.get('reasoning', 'Non è una richiesta relativa al calendario')
            }
        
        # Processa l'intento calendario
        action = intent_data.get('action', 'none')
        result = None
        response = None
        
        try:
            # Import qui per evitare dipendenze circolari
            from calendar_utils import format_event_response
            
            if action == 'create':
                result = self._create_event(intent_data)
                response = format_event_response(result, 'create')
                
            elif action == 'update':
                result = self._update_event(intent_data)
                response = format_event_response(result, 'update')
                
            elif action == 'delete':
                result = self._delete_event(intent_data)
                response = format_event_response(result, 'delete')
                
            elif action == 'view':
                result = self._view_events(intent_data)
                response = format_event_response(result, 'view')
        
        except Exception as e:
            import traceback
            print(f"Error in calendar agent: {str(e)}")
            print(traceback.format_exc())
            
            return {
                "is_calendar_intent": True,
                "action": action,
                "success": False,
                "response": f"Mi dispiace, c'è stato un errore: {str(e)}",
                "error": str(e)
            }
        
        return {
            "is_calendar_intent": True,
            "action": action,
            "success": True,
            "response": response,
            "result": result,
            "intent": intent_data
        }
    
    def _create_event(self, intent_data):
        """Crea un nuovo evento nel calendario"""
        # Import qui per evitare dipendenze circolari
        from calendar_utils import parse_relative_date, parse_time
        
        # Estrai e normalizza i dati dall'intent
        title = intent_data.get('title')
        if not title:
            raise ValueError("Titolo dell'evento mancante")
            
        description = intent_data.get('description', '')
        category = intent_data.get('category', 'personal')
            
        # Gestisci la data
        date_str = intent_data.get('date')
        date_obj = parse_relative_date(date_str) if date_str else datetime.now().date()
        
        if not date_obj:
            date_obj = datetime.now().date()
            
        # Gestisci l'ora di inizio
        start_time = parse_time(intent_data.get('start_time'))
        if not start_time:
            start_time = "09:00"  # Default alle 9:00
            
        # Calcola l'ora di fine
        end_time = parse_time(intent_data.get('end_time'))
        duration_minutes = intent_data.get('duration_minutes')
        
        if end_time:
            # Usa l'ora di fine specificata
            pass
        elif duration_minutes:
            # Calcola l'ora di fine in base alla durata
            start_dt = datetime.strptime(start_time, "%H:%M")
            end_dt = start_dt + timedelta(minutes=int(duration_minutes))
            end_time = end_dt.strftime("%H:%M")
        else:
            # Default: durata di 1 ora
            start_dt = datetime.strptime(start_time, "%H:%M")
            end_dt = start_dt + timedelta(hours=1)
            end_time = end_dt.strftime("%H:%M")
        
        # Formatta le date in ISO
        start_date_iso = f"{date_obj.isoformat()}T{start_time}:00"
        end_date_iso = f"{date_obj.isoformat()}T{end_time}:00"
        
        # Prepara i dati per la richiesta API
        event_data = {
            "user_id": self.default_user_id,
            "titolo": title,
            "descrizione": description,
            "dataInizio": start_date_iso,
            "dataFine": end_date_iso,
            "categoria": category,
            "allDay": False
        }
        
        # Chiama l'API per creare l'evento
        url = f"{self.calendar_api_base_url}/events"
        response = requests.post(url, json=event_data)
        
        if not response.ok:
            raise Exception(f"Errore API ({response.status_code}): {response.text}")
            
        return response.json().get('evento', {})
    
    def _find_matching_event(self, intent_data):
        """Trova un evento che corrisponde ai criteri specificati"""
        title = intent_data.get('title')
        date_str = intent_data.get('date')
        
        if not title and not date_str:
            raise ValueError("Informazioni insufficienti per trovare l'evento")
        
        # Import qui per evitare dipendenze circolari
        from calendar_utils import parse_relative_date
        
        # Gestisci la data
        start_date = None
        end_date = None
        
        if date_str:
            date_obj = parse_relative_date(date_str)
            if date_obj:
                start_date = date_obj.isoformat()
                end_date = (date_obj + timedelta(days=1)).isoformat()
        
        # Se non abbiamo una data, usa oggi e domani
        if not start_date:
            today = datetime.now().date()
            start_date = today.isoformat()
            end_date = (today + timedelta(days=30)).isoformat()
        
        # Chiama l'API per ottenere gli eventi in questo periodo
        url = f"{self.calendar_api_base_url}/events"
        params = {
            "start": start_date,
            "end": end_date,
            "user_id": self.default_user_id
        }
        
        response = requests.get(url, params=params)
        
        if not response.ok:
            raise Exception(f"Errore API ({response.status_code}): {response.text}")
            
        events = response.json()
        
        # Filtra per titolo se specificato
        if title:
            title_lower = title.lower()
            matching_events = [
                event for event in events 
                if title_lower in event.get('titolo', '').lower()
            ]
            
            if matching_events:
                return matching_events[0]  # Ritorna il primo match
        
        # Se non ci sono match o titolo non specificato
        if events:
            return events[0]  # Ritorna il primo evento del periodo
            
        return None
    
    def _update_event(self, intent_data):
        """Aggiorna un evento esistente"""
        # Import qui per evitare dipendenze circolari
        from calendar_utils import parse_relative_date, parse_time
        
        # Prima troviamo l'evento da aggiornare
        event_id = intent_data.get('event_id')
        
        if not event_id:
            # Cerca l'evento in base al titolo e/o data
            event = self._find_matching_event(intent_data)
            if not event:
                raise ValueError("Non ho trovato eventi corrispondenti ai criteri specificati")
            event_id = event.get('id')
        
        # Prepara i dati per l'aggiornamento
        update_data = {}
        
        if 'title' in intent_data and intent_data['title']:
            update_data['titolo'] = intent_data['title']
            
        if 'description' in intent_data and intent_data['description']:
            update_data['descrizione'] = intent_data['description']
            
        if 'category' in intent_data and intent_data['category']:
            update_data['categoria'] = intent_data['category']
        
        # Gestione date e orari
        date_str = intent_data.get('date')
        start_time = intent_data.get('start_time')
        end_time = intent_data.get('end_time')
        
        if date_str or start_time or end_time:
            # Ottieni l'evento originale per conoscere i valori attuali
            url = f"{self.calendar_api_base_url}/events/{event_id}"
            response = requests.get(url)
            
            if not response.ok:
                raise Exception(f"Errore API ({response.status_code}): {response.text}")
                
            original_event = response.json()
            
            # Estrai data e ora originali
            original_start = original_event.get('dataInizio', '').split('T')
            original_date = original_start[0] if len(original_start) > 0 else None
            original_time = original_start[1][:5] if len(original_start) > 1 else None
            
            # Calcola la nuova data
            if date_str:
                date_obj = parse_relative_date(date_str)
                if date_obj:
                    new_date = date_obj.isoformat()
                else:
                    new_date = original_date
            else:
                new_date = original_date
            
            # Calcola la nuova ora di inizio
            new_start_time = parse_time(start_time) if start_time else original_time
            
            # Formatta la nuova data di inizio
            if new_date and new_start_time:
                update_data['dataInizio'] = f"{new_date}T{new_start_time}:00"
            
            # Gestisci l'ora di fine se specificata
            if end_time:
                new_end_time = parse_time(end_time)
                if new_end_time and new_date:
                    update_data['dataFine'] = f"{new_date}T{new_end_time}:00"
            
            # Se abbiamo cambiato l'ora di inizio ma non quella di fine
            elif 'dataInizio' in update_data and 'dataFine' not in update_data:
                # Mantieni la stessa durata dell'evento originale
                original_end = original_event.get('dataFine', '').split('T')
                if len(original_end) > 1:
                    original_start_datetime = datetime.fromisoformat(original_event.get('dataInizio').replace('Z', '+00:00'))
                    original_end_datetime = datetime.fromisoformat(original_event.get('dataFine').replace('Z', '+00:00'))
                    duration = original_end_datetime - original_start_datetime
                    
                    # Calcola la nuova fine in base alla nuova data di inizio
                    new_start_datetime = datetime.fromisoformat(update_data['dataInizio'].replace('Z', '+00:00'))
                    new_end_datetime = new_start_datetime + duration
                    update_data['dataFine'] = new_end_datetime.isoformat()
        
        # Aggiorna l'evento tramite API
        url = f"{self.calendar_api_base_url}/events/{event_id}"
        response = requests.put(url, json=update_data)
        
        if not response.ok:
            raise Exception(f"Errore API ({response.status_code}): {response.text}")
            
        return response.json().get('evento', {})
    
    def _delete_event(self, intent_data):
        """Elimina un evento esistente"""
        # Prima troviamo l'evento da eliminare
        event_id = intent_data.get('event_id')
        
        if not event_id:
            # Cerca l'evento in base al titolo e/o data
            event = self._find_matching_event(intent_data)
            if not event:
                raise ValueError("Non ho trovato eventi corrispondenti ai criteri specificati")
            event_id = event.get('id')
        
        # Elimina l'evento tramite API
        url = f"{self.calendar_api_base_url}/events/{event_id}"
        response = requests.delete(url)
        
        if not response.ok:
            raise Exception(f"Errore API ({response.status_code}): {response.text}")
            
        return {"success": True, "id": event_id}
    
    def _view_events(self, intent_data):
        """Visualizza eventi in un determinato periodo"""
        # Import qui per evitare dipendenze circolari
        from calendar_utils import parse_relative_date, get_period_dates
        
        period = intent_data.get('period')
        date_str = intent_data.get('date')
        
        start_date = None
        end_date = None
        
        if period:
            # Periodo predefinito (today, this_week, ecc.)
            start_date, end_date = get_period_dates(period)
        elif date_str:
            # Data specifica
            date_obj = parse_relative_date(date_str)
            if date_obj:
                start_date = date_obj.isoformat()
                end_date = start_date
        else:
            # Default: oggi
            today = datetime.now().date()
            start_date = today.isoformat()
            end_date = start_date
        
        # Estendi date di un giorno per catturare gli eventi dell'intera giornata
        if start_date == end_date:
            end_obj = datetime.fromisoformat(end_date)
            end_date = (end_obj + timedelta(days=1)).isoformat()
        
        # Chiama l'API per ottenere gli eventi
        url = f"{self.calendar_api_base_url}/events"
        params = {
            "start": start_date,
            "end": end_date,
            "user_id": self.default_user_id
        }
        
        response = requests.get(url, params=params)
        
        if not response.ok:
            raise Exception(f"Errore API ({response.status_code}): {response.text}")
            
        events = response.json()
        
        # Ordina gli eventi per data
        events.sort(key=lambda x: x.get('dataInizio', ''))
        
        return events