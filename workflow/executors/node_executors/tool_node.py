# executors/node_executors/tool_node.py
import time
import json
import requests
from ..base import NodeExecutor

class ToolNodeExecutor(NodeExecutor):
    """Executor per nodi di tipo Tool"""
    
    def execute(self, input_data):
        """Esegue un tool esterno"""
        start_time = time.time()
        
        try:
            # Ottieni tipo di tool
            tool_type = self.config.get('tool_type', 'api')
            
            # Esegui il tool in base al tipo
            if tool_type == 'api':
                result = self._execute_api_tool(input_data)
            elif tool_type == 'python':
                result = self._execute_python_tool(input_data)
            elif tool_type == 'sql':
                result = self._execute_sql_tool(input_data)
            else:
                raise ValueError(f"Unsupported tool type: {tool_type}")
            
            # Crea output data
            output_data = {
                **input_data,
                "tool_result": result
            }
            
            # Log dell'esecuzione
            duration_ms = int((time.time() - start_time) * 1000)
            return self.log_execution(
                input_data=input_data,
                output_data=output_data,
                status="completed",
                message=f"Tool executed successfully: {tool_type}",
                duration_ms=duration_ms
            )
            
        except Exception as e:
            # Log dell'errore
            duration_ms = int((time.time() - start_time) * 1000)
            error_message = f"Error executing Tool node: {str(e)}"
            self.log_execution(
                input_data=input_data,
                output_data=None,
                status="failed",
                message=error_message,
                duration_ms=duration_ms
            )
            raise
    
# executors/node_executors/tool_node.py (continuazione)
    def _execute_api_tool(self, input_data):
        """Esegue una chiamata API"""
        # Estrai parametri di configurazione
        endpoint = self.config.get('api_endpoint', '')
        method = self.config.get('api_method', 'GET').upper()
        headers = self.config.get('headers', {})
        
        # Prepara parametri o body in base all'input
        params = {}
        json_body = None
        
        if method == 'GET':
            # Per GET, usa i dati di input come parametri query
            for key, value in input_data.items():
                if isinstance(value, (str, int, float, bool)):
                    params[key] = value
        else:
            # Per POST/PUT, usa i dati di input come body JSON
            json_body = input_data
        
        # Esegui la richiesta
        if method == 'GET':
            response = requests.get(endpoint, params=params, headers=headers)
        elif method == 'POST':
            response = requests.post(endpoint, json=json_body, headers=headers)
        elif method == 'PUT':
            response = requests.put(endpoint, json=json_body, headers=headers)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        # Verifica la risposta
        response.raise_for_status()
        
        # Prova a parsare come JSON, altrimenti restituisci testo
        try:
            return response.json()
        except:
            return response.text
    
    def _execute_python_tool(self, input_data):
        """Esegue codice Python (versione sicura e semplificata)"""
        # Ottieni il codice dalla configurazione
        code = self.config.get('python_code', '')
        
        # NOTA: Questo approccio è semplificato. In produzione,
        # dovresti usare un ambiente di esecuzione isolato per sicurezza,
        # come un subprocess, un container o un servizio separato.
        
        # Crea una funzione dalle stringhe
        # Definisci un namespace limitato
        safe_globals = {
            'json': json,
            'requests': requests,
            # Aggiungi altre librerie sicure qui
        }
        
        # Crea un locale per memorizzare la funzione
        local_vars = {}
        
        # Compila ed esegui il codice per definire la funzione execute
        exec(code, safe_globals, local_vars)
        
        # Verifica che la funzione 'execute' sia definita
        if 'execute' not in local_vars:
            raise ValueError("Python code must define an 'execute' function")
        
        # Esegui la funzione
        result = local_vars['execute'](input_data)
        return result
    
    def _execute_sql_tool(self, input_data):
        """Esegue una query SQL"""
        # Questa è una versione semplificata - in produzione
        # dovresti implementare controlli di sicurezza più robusti
        
        from ...db.connection import get_db_cursor
        
        # Ottieni la query dalla configurazione
        query = self.config.get('sql_query', '')
        
        # Sostituisci i placeholder nella query
        for key, value in input_data.items():
            placeholder = f"{{{key}}}"
            if placeholder in query:
                # Sanitizza il valore in base al tipo
                if isinstance(value, (int, float)):
                    # I numeri possono essere inseriti direttamente
                    query = query.replace(placeholder, str(value))
                elif isinstance(value, str):
                    # Le stringhe devono essere escapate
                    query = query.replace(placeholder, f"'{value.replace("'", "''")}'")
                else:
                    # Altri tipi vengono convertiti in JSON
                    json_value = json.dumps(value)
                    query = query.replace(placeholder, f"'{json_value.replace("'", "''")}'")
        
        # Esegui la query
        with get_db_cursor() as cursor:
            cursor.execute(query)
            # Se è una query SELECT, restituisci i risultati
            if query.strip().lower().startswith('select'):
                results = cursor.fetchall()
                return [dict(row) for row in results]
            # Altrimenti restituisci il numero di righe modificate
            return {"rows_affected": cursor.rowcount}