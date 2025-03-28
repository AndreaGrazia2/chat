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

import logging
import traceback
from datetime import datetime, timedelta

# Configurazione del logger - aggiungi dopo gli import
logging.basicConfig(
    level=logging.CRITICAL,
    handlers=[logging.NullHandler()]
)

logger = logging.getLogger('calendar_agent')

class CalendarAgent:
    def __init__(self, llm, calendar_api_base_url=None):        
        """
        Inizializza l'agente calendario
        
        Args:
            llm: Modello di linguaggio (LangChain)
            calendar_api_base_url: URL base delle API calendario
        """
        self.llm = llm
        
        # Se non viene fornito un URL base, usa quello dalla configurazione
        if calendar_api_base_url is None:
            from common.config import API_BASE_URL
            self.calendar_api_base_url = f"{API_BASE_URL}/cal/api"
        else:
            self.calendar_api_base_url = calendar_api_base_url
        
        # Import qui per evitare dipendenze circolari
        from agent.calendar_intent import create_calendar_intent_chain, parse_intent_response
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
        logger.info(f"Elaborazione messaggio: '{user_input}'")
        
        if user_id:
            self.default_user_id = user_id
            logger.info(f"Impostato user_id: {user_id}")
            
        # Analizza l'intento
        logger.info("Invocazione della chain di intento")
        raw_intent = self.intent_chain.invoke({"user_input": user_input, "current_year": datetime.now().year})
        
        from agent.calendar_intent import parse_intent_response
        intent_data = parse_intent_response(raw_intent)
        
        # Log dell'intento rilevato (per debug)
        logger.info(f"Calendar intent detected: {json.dumps(intent_data, indent=2)}")
        
        # Se non è un intento calendario, ritorna subito
        if not intent_data.get('is_calendar_intent', False):
            logger.info("Non è un intento calendario")
            return {
                "is_calendar_intent": False,
                "response": None,
                "reasoning": intent_data.get('reasoning', 'Non è una richiesta relativa al calendario')
            }
        
        # Processa l'intento calendario
        action = intent_data.get('action', 'none')
        logger.info(f"Azione rilevata: {action}")
        result = None
        response = None
        
        try:
            # Import qui per evitare dipendenze circolari
            from agent.calendar_utils import format_event_response
            
            if action == 'create':
                logger.info("Esecuzione creazione evento")
                result = self._create_event(intent_data)
                response = format_event_response(result, 'create')
                
            elif action == 'update':
                logger.info("Esecuzione aggiornamento evento")
                result = self._update_event(intent_data)
                response = format_event_response(result, 'update')
                
            elif action == 'delete':
                logger.info("Esecuzione eliminazione evento")
                result = self._delete_event(intent_data)
                response = format_event_response(result, 'delete')
                
            elif action == 'view':
                logger.info("Esecuzione visualizzazione eventi")
                result = self._view_events(intent_data)
                response = format_event_response(result, 'view')
        
        except Exception as e:
            logger.error(f"Errore in calendar agent: {str(e)}")
            logger.error(traceback.format_exc())
            
            return {
                "is_calendar_intent": True,
                "action": action,
                "success": False,
                "response": f"Mi dispiace, c'è stato un errore: {str(e)}",
                "error": str(e)
            }
        
        logger.info(f"Operazione completata con successo. Risposta: {response}")
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
        from agent.calendar_utils import parse_relative_date, parse_time
        
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
        import logging
        logger = logging.getLogger('calendar_agent')
        
        # Estrai sia i dati originali che quelli nuovi dall'intent
        title = intent_data.get('title')
        original_title = intent_data.get('original_title', title)
        
        date_str = intent_data.get('date')
        original_date_str = intent_data.get('original_date', date_str)
        
        start_time = intent_data.get('start_time')
        original_start_time = intent_data.get('original_start_time', start_time)
        
        logger.info(f"Ricerca evento con dati originali - titolo: '{original_title}', " +
                    f"data: {original_date_str}, ora: {original_start_time}")
        
        if not original_title and not original_date_str:
            logger.error("Informazioni insufficienti per trovare l'evento")
            raise ValueError("Informazioni insufficienti per trovare l'evento. " +
                            "Specifica almeno il titolo o la data dell'evento da modificare.")
        
        # Import qui per evitare dipendenze circolari
        from agent.calendar_utils import parse_relative_date, parse_time
        
        # Gestisci la data originale per la ricerca
        start_date = None
        end_date = None
        
        # Se abbiamo una data originale, usa quella per cercare
        if original_date_str:
            date_obj = parse_relative_date(original_date_str)
            if date_obj:
                # Usa un range di 3 giorni attorno alla data per essere più flessibili
                start_date = (date_obj - timedelta(days=1)).isoformat()
                end_date = (date_obj + timedelta(days=1)).isoformat()
                logger.info(f"Cercando in un intervallo flessibile: {start_date} fino a {end_date}")
        
        # Se non abbiamo una data originale, usa un intervallo più ampio
        if not start_date:
            today = datetime.now().date()
            start_date = (today - timedelta(days=7)).isoformat()  # Una settimana indietro
            end_date = (today + timedelta(days=30)).isoformat()   # Un mese in avanti
            logger.info(f"Usando intervallo di date ampio: {start_date} fino a {end_date}")
        
        # Chiama l'API per ottenere gli eventi in questo periodo
        url = f"{self.calendar_api_base_url}/events"
        params = {
            "start": start_date,
            "end": end_date,
            "user_id": self.default_user_id
        }
        
        logger.info(f"Richiesta GET a {url} con parametri: {params}")
        response = requests.get(url, params=params)
        
        if not response.ok:
            logger.error(f"Errore API ({response.status_code}): {response.text}")
            raise Exception(f"Errore API ({response.status_code}): {response.text}")
            
        events = response.json()
        logger.info(f"Recuperati {len(events)} eventi nel periodo specificato")
        
        if len(events) == 0:
            # Se non ci sono eventi nel periodo, amplia ancora di più la ricerca
            today = datetime.now().date()
            extended_start = (today - timedelta(days=30)).isoformat()  # Un mese indietro
            extended_end = (today + timedelta(days=90)).isoformat()    # Tre mesi in avanti
            
            params = {
                "start": extended_start,
                "end": extended_end,
                "user_id": self.default_user_id
            }
            
            logger.info(f"Tentativo con intervallo ancora più ampio: {extended_start} fino a {extended_end}")
            response = requests.get(url, params=params)
            
            if response.ok:
                events = response.json()
                logger.info(f"Recuperati {len(events)} eventi nel periodo esteso")
        
        # Se ancora non ci sono eventi, non possiamo fare altro
        if len(events) == 0:
            logger.error("Nessun evento trovato nel calendario")
            raise ValueError("Non ho trovato eventi nel calendario. Prima di modificare " + 
                            "un evento, assicurati che sia stato creato.")
        
        # Se abbiamo il titolo originale e l'ora originale, cerchiamo una corrispondenza esatta
        if original_title and original_start_time:
            original_time_str = parse_time(original_start_time)
            date_obj = None
            if original_date_str:
                date_obj = parse_relative_date(original_date_str)
            
            if date_obj and original_time_str:
                formatted_datetime = f"{date_obj.isoformat()}T{original_time_str}"
                logger.info(f"Cercando eventi con titolo e datetime: '{original_title}', {formatted_datetime}")
                
                # Cerca per titolo esatto e data/ora esatta
                exact_matches = [
                    event for event in events 
                    if (original_title.lower() == event.get('titolo', '').lower() and 
                        formatted_datetime in event.get('dataInizio', ''))
                ]
                
                if exact_matches:
                    logger.info(f"Trovato evento con titolo e datetime esatti: {exact_matches[0].get('titolo')}")
                    return exact_matches[0]
        
        # Se abbiamo solo il titolo originale, cerchiamo per titolo
        if original_title:
            title_lower = original_title.lower()
            logger.info(f"Cercando eventi con titolo: '{title_lower}'")
            
            # Prima cerca corrispondenza esatta del titolo
            exact_title_matches = [
                event for event in events 
                if title_lower == event.get('titolo', '').lower()
            ]
            
            if exact_title_matches:
                # Se ci sono più eventi con lo stesso titolo esatto, prendi quello più vicino alla data specificata
                if len(exact_title_matches) > 1 and original_date_str:
                    date_obj = parse_relative_date(original_date_str)
                    if date_obj:
                        # Ordina gli eventi per vicinanza alla data specificata
                        exact_title_matches.sort(key=lambda e: abs(
                            datetime.fromisoformat(e.get('dataInizio', '').split('T')[0]) - date_obj
                        ))
                
                logger.info(f"Trovato evento con titolo esatto: {exact_title_matches[0].get('titolo')}")
                return exact_title_matches[0]
            
            # Poi cerca corrispondenza parziale del titolo
            partial_title_matches = [
                event for event in events 
                if title_lower in event.get('titolo', '').lower() or 
                event.get('titolo', '').lower() in title_lower
            ]
            
            if partial_title_matches:
                logger.info(f"Trovato evento con titolo parziale: {partial_title_matches[0].get('titolo')}")
                return partial_title_matches[0]
        
        # Se abbiamo solo la data originale, prendi l'evento più vicino a quell'ora
        if original_date_str and original_start_time:
            date_obj = parse_relative_date(original_date_str)
            time_str = parse_time(original_start_time)
            
            if date_obj and time_str:
                target_datetime = datetime.fromisoformat(f"{date_obj.isoformat()}T{time_str}:00")
                logger.info(f"Cercando evento più vicino a: {target_datetime}")
                
                # Ordina per vicinanza alla data/ora specificata
                events_with_distance = []
                for event in events:
                    try:
                        event_start = datetime.fromisoformat(event.get('dataInizio', '').replace('Z', '+00:00'))
                        time_diff = abs((event_start - target_datetime).total_seconds())
                        events_with_distance.append((event, time_diff))
                    except (ValueError, TypeError):
                        continue
                
                if events_with_distance:
                    # Ordina per distanza temporale
                    events_with_distance.sort(key=lambda x: x[1])
                    closest_event = events_with_distance[0][0]
                    logger.info(f"Trovato evento più vicino temporalmente: {closest_event.get('titolo')}")
                    return closest_event
        
        # Come fallback, ritorna il primo evento disponibile
        logger.info(f"Utilizzando il primo evento disponibile: {events[0].get('titolo')}")
        return events[0]
    
    def _update_event(self, intent_data):
        """Aggiorna un evento esistente"""
        import logging
        logger = logging.getLogger('calendar_agent')
        
        # Import qui per evitare dipendenze circolari
        from agent.calendar_utils import parse_relative_date, parse_time
        
        logger.info(f"Tentativo di aggiornamento evento con dati: {json.dumps(intent_data, indent=2)}")
        
        # Prima troviamo l'evento da aggiornare
        event_id = intent_data.get('event_id')
        
        if not event_id:
            # Cerca l'evento in base ai dati originali
            logger.info("Nessun ID evento fornito, cercando l'evento...")
            try:
                event = self._find_matching_event(intent_data)
                if not event:
                    logger.error("Nessun evento trovato corrispondente ai criteri specificati")
                    raise ValueError("Non ho trovato eventi corrispondenti ai criteri specificati")
                event_id = event.get('id')
                logger.info(f"Evento trovato con ID: {event_id}, titolo: {event.get('titolo')}")
            except Exception as e:
                logger.error(f"Errore durante la ricerca dell'evento: {str(e)}")
                raise ValueError(f"Errore durante la ricerca dell'evento: {str(e)}")
        
        # Prepara i dati per l'aggiornamento
        update_data = {}
        
        # Se stiamo cambiando il titolo (nella fase di spostamento)
        new_title = intent_data.get('title')
        original_title = intent_data.get('original_title')
        
        if new_title and new_title != original_title:
            update_data['titolo'] = new_title
            logger.info(f"Aggiornamento titolo da '{original_title}' a '{new_title}'")
        
        if 'description' in intent_data and intent_data['description']:
            update_data['descrizione'] = intent_data['description']
            logger.info(f"Aggiornamento descrizione: {intent_data['description']}")
            
        if 'category' in intent_data and intent_data['category']:
            update_data['categoria'] = intent_data['category']
            logger.info(f"Aggiornamento categoria: {intent_data['category']}")
        
        # Gestione date e orari
        date_str = intent_data.get('date')
        start_time = intent_data.get('start_time')
        end_time = intent_data.get('end_time')
        
        logger.info(f"Dati temporali ricevuti - data: {date_str}, ora inizio: {start_time}, ora fine: {end_time}")
        
        # Ottieni l'evento originale per conoscere i valori attuali
        url = f"{self.calendar_api_base_url}/events/{event_id}"
        response = requests.get(url)
        
        if not response.ok:
            logger.error(f"Errore API ({response.status_code}) durante il recupero dell'evento: {response.text}")
            raise Exception(f"Errore API ({response.status_code}): {response.text}")
            
        original_event = response.json()
        logger.info(f"Evento originale: {json.dumps(original_event, indent=2)}")
        
        # Calcola la nuova data
        if date_str:
            logger.info(f"Elaborazione nuova data: {date_str}")
            date_obj = parse_relative_date(date_str)
            if date_obj:
                new_date = date_obj.isoformat()
                logger.info(f"Nuova data convertita: {new_date}")
            else:
                # Estrai data originale
                original_start = original_event.get('dataInizio', '').split('T')
                new_date = original_start[0] if len(original_start) > 0 else None
                logger.warning(f"Impossibile parsare la data '{date_str}', mantengo originale: {new_date}")
        else:
            # Estrai data originale
            original_start = original_event.get('dataInizio', '').split('T')
            new_date = original_start[0] if len(original_start) > 0 else None
            logger.info(f"Nessuna nuova data fornita, mantengo originale: {new_date}")
        
        # Calcola la nuova ora di inizio
        if start_time:
            logger.info(f"Elaborazione nuova ora di inizio: {start_time}")
            new_start_time = parse_time(start_time)
            if new_start_time:
                logger.info(f"Nuova ora di inizio convertita: {new_start_time}")
            else:
                logger.warning(f"Impossibile parsare l'ora '{start_time}'")
                # Estrai ora originale
                original_start = original_event.get('dataInizio', '').split('T')
                new_start_time = original_start[1][:5] if len(original_start) > 1 else "00:00"
                logger.info(f"Usando ora di inizio originale: {new_start_time}")
        else:
            # Estrai ora originale
            original_start = original_event.get('dataInizio', '').split('T')
            new_start_time = original_start[1][:5] if len(original_start) > 1 else "00:00"
            logger.info(f"Nessuna nuova ora di inizio fornita, mantengo originale: {new_start_time}")
        
        # Formatta la nuova data di inizio
        if new_date and new_start_time:
            update_data['dataInizio'] = f"{new_date}T{new_start_time}:00"
            logger.info(f"Nuova data di inizio completa: {update_data['dataInizio']}")
        
        # Gestisci l'ora di fine
        if end_time:
            logger.info(f"Elaborazione nuova ora di fine: {end_time}")
            new_end_time = parse_time(end_time)
            if new_end_time and new_date:
                update_data['dataFine'] = f"{new_date}T{new_end_time}:00"
                logger.info(f"Nuova data di fine: {update_data['dataFine']}")
            else:
                logger.warning(f"Impossibile parsare l'ora di fine '{end_time}'")
        
        # Se abbiamo solo la data di inizio ma non la fine, calcola la fine mantenendo la durata originale
        if 'dataInizio' in update_data and 'dataFine' not in update_data:
            try:
                logger.info("Calcolo nuova ora di fine basata sulla durata originale")
                original_start_datetime = datetime.fromisoformat(original_event.get('dataInizio').replace('Z', '+00:00'))
                original_end_datetime = datetime.fromisoformat(original_event.get('dataFine').replace('Z', '+00:00'))
                duration = original_end_datetime - original_start_datetime
                logger.info(f"Durata originale: {duration}")
                
                # Calcola la nuova fine in base alla nuova data di inizio
                new_start_datetime = datetime.fromisoformat(update_data['dataInizio'].replace('Z', '+00:00'))
                new_end_datetime = new_start_datetime + duration
                update_data['dataFine'] = new_end_datetime.isoformat()
                logger.info(f"Nuova data di fine calcolata: {update_data['dataFine']}")
            except Exception as e:
                logger.error(f"Errore nel calcolo della nuova ora di fine: {str(e)}")
                logger.error(traceback.format_exc())
        
        # Assicurati che ci siano dati da aggiornare
        if not update_data:
            logger.warning("Nessun dato da aggiornare specificato")
            return original_event
        
        # Log finale dei dati di aggiornamento
        logger.info(f"Dati di aggiornamento finali: {json.dumps(update_data, indent=2)}")
        
        # Aggiorna l'evento tramite API
        url = f"{self.calendar_api_base_url}/events/{event_id}"
        logger.info(f"Invio richiesta PUT a {url}")
        response = requests.put(url, json=update_data)
        
        if not response.ok:
            logger.error(f"Errore API ({response.status_code}) durante l'aggiornamento: {response.text}")
            raise Exception(f"Errore API ({response.status_code}): {response.text}")
        
        result = response.json().get('evento', {})
        logger.info(f"Aggiornamento completato: {json.dumps(result, indent=2)}")    
        return result
    
    def _delete_event(self, intent_data):
        """Elimina un evento esistente"""
        import logging
        logger = logging.getLogger('calendar_agent')
        
        logger.info(f"Tentativo di eliminazione evento con dati: {json.dumps(intent_data, indent=2)}")
        
        # Prima troviamo l'evento da eliminare
        event_id = intent_data.get('event_id')
        
        if not event_id:
            # Prepara i dati per la ricerca - adatta i campi per compatibilità con _find_matching_event
            # Il problema è che nell'intent di delete non ci sono i campi original_*
            search_data = intent_data.copy()
            
            # Per cancellazione, usa il titolo normale come original_title se original_title non è presente
            if 'title' in search_data and not search_data.get('original_title'):
                search_data['original_title'] = search_data['title']
                
            # Per cancellazione, usa la data normale come original_date se original_date non è presente
            if 'date' in search_data and not search_data.get('original_date'):
                search_data['original_date'] = search_data['date']
                
            # Per cancellazione, usa l'ora normale come original_start_time se original_start_time non è presente
            if 'start_time' in search_data and not search_data.get('original_start_time'):
                search_data['original_start_time'] = search_data['start_time']
            
            # Cerca l'evento in base al titolo e/o data
            logger.info(f"Nessun ID evento fornito, ricerca con dati adattati: {json.dumps(search_data, indent=2)}")
            try:
                event = self._find_matching_event(search_data)
                if not event:
                    logger.error("Nessun evento trovato corrispondente ai criteri specificati")
                    raise ValueError("Non ho trovato eventi corrispondenti ai criteri specificati")
                event_id = event.get('id')
                logger.info(f"Evento trovato con ID: {event_id}, titolo: {event.get('titolo')}")
            except Exception as e:
                logger.error(f"Errore durante la ricerca dell'evento: {str(e)}")
                raise ValueError(f"Errore durante la ricerca dell'evento: {str(e)}")
        
        # Elimina l'evento tramite API
        url = f"{self.calendar_api_base_url}/events/{event_id}"
        logger.info(f"Invio richiesta DELETE a {url}")
        response = requests.delete(url)
        
        if not response.ok:
            logger.error(f"Errore API ({response.status_code}) durante l'eliminazione: {response.text}")
            raise Exception(f"Errore API ({response.status_code}): {response.text}")
        
        logger.info(f"Evento eliminato con successo: {event_id}")
        return {"success": True, "id": event_id}
    
    def _view_events(self, intent_data):
        """Visualizza eventi in un determinato periodo"""
        # Import qui per evitare dipendenze circolari
        from agent.calendar_utils import parse_relative_date, get_period_dates
        
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