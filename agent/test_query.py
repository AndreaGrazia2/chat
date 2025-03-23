# Script per verificare la connessione al database e test di query
import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# Carica le variabili d'ambiente
load_dotenv()

def test_connection():
    """Testa la connessione al database e stampa le tabelle disponibili"""
    try:
        print("Tentativo di connessione al database...")
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            cursor_factory=psycopg2.extras.DictCursor
        )
        print("✅ Connessione stabilita con successo!")
        
        cursor = conn.cursor()
        
        # Verifica lo schema attuale
        print("\nSchema attualmente selezionato:")
        cursor.execute("SELECT current_schema();")
        current_schema = cursor.fetchone()[0]
        print(f"Schema attuale: {current_schema}")
        
        # Lista delle tabelle nello schema chat_schema
        print("\nTabelle disponibili nello schema chat_schema:")
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'chat_schema'
        """)
        tables = cursor.fetchall()
        if tables:
            for table in tables:
                print(f"- {table[0]}")
        else:
            print("Nessuna tabella trovata nello schema chat_schema.")
        
        # Verifica se esiste la tabella users
        print("\nVerifica della tabella users:")
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'chat_schema' AND table_name = 'users'
            );
        """)
        has_users_table = cursor.fetchone()[0]
        if has_users_table:
            print("✅ La tabella users esiste")
            
            # Verifica se ci sono utenti con username john_doe
            cursor.execute("""
                SELECT COUNT(*) FROM chat_schema.users WHERE username = 'john_doe'
            """)
            john_doe_count = cursor.fetchone()[0]
            print(f"Utenti con username 'john_doe': {john_doe_count}")
            
            # Visualizza gli users disponibili (primi 5)
            cursor.execute("""
                SELECT id, username FROM chat_schema.users LIMIT 5
            """)
            users = cursor.fetchall()
            if users:
                print("\nAlcuni utenti disponibili:")
                for user in users:
                    print(f"- ID: {user[0]}, Username: {user[1]}")
            else:
                print("Nessun utente trovato nella tabella users.")
        else:
            print("❌ La tabella users non esiste nello schema chat_schema.")

        # Verifica messaggi
        print("\nVerifica della tabella messages:")
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'chat_schema' AND table_name = 'messages'
            );
        """)
        has_messages_table = cursor.fetchone()[0]
        if has_messages_table:
            print("✅ La tabella messages esiste")
            
            # Conteggio totale dei messaggi
            cursor.execute("""
                SELECT COUNT(*) FROM chat_schema.messages
            """)
            message_count = cursor.fetchone()[0]
            print(f"Totale messaggi nel sistema: {message_count}")
        else:
            print("❌ La tabella messages non esiste nello schema chat_schema.")
        
        # Chiudi la connessione
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Errore: {e}")

def test_specific_query():
    """Testa una query specifica per recuperare i messaggi di john_doe"""
    try:
        print("\nTest query specifica per i messaggi di john_doe:")
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            cursor_factory=psycopg2.extras.DictCursor
        )
        cursor = conn.cursor()
        
        # Prima identifica l'id dell'utente john_doe
        query_user = """
            SELECT id FROM chat_schema.users WHERE username = 'john_doe' LIMIT 1
        """
        cursor.execute(query_user)
        user_result = cursor.fetchone()
        
        if user_result:
            user_id = user_result[0]
            print(f"ID utente di john_doe: {user_id}")
            
            # Ora recupera i messaggi
            query_messages = """
                SELECT m.id, m.text, m.created_at, c.name as conversation_name
                FROM chat_schema.messages m
                JOIN chat_schema.conversations c ON m.conversation_id = c.id
                WHERE m.user_id = %s
                ORDER BY m.created_at DESC
                LIMIT 5
            """
            cursor.execute(query_messages, (user_id,))
            messages = cursor.fetchall()
            
            if messages:
                print(f"Trovati {len(messages)} messaggi per john_doe:")
                for msg in messages:
                    print(f"- ID: {msg['id']}, Testo: {msg['text'][:50]}..., Data: {msg['created_at']}")
            else:
                print("Nessun messaggio trovato per john_doe.")
                
                # Verifichiamo se l'utente ha partecipazioni a conversazioni
                cursor.execute("""
                    SELECT COUNT(*) FROM chat_schema.conversation_participants 
                    WHERE user_id = %s
                """, (user_id,))
                conv_count = cursor.fetchone()[0]
                print(f"John_doe partecipa a {conv_count} conversazioni.")
        else:
            print("❌ Utente john_doe non trovato nel database.")
            
            # Suggerimenti per username simili
            cursor.execute("""
                SELECT username FROM chat_schema.users 
                WHERE username ILIKE '%john%' OR username ILIKE '%doe%'
                LIMIT 5
            """)
            similar_users = cursor.fetchall()
            if similar_users:
                print("Utenti con nomi simili:")
                for user in similar_users:
                    print(f"- {user[0]}")
        
        # Chiudi la connessione
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Errore nell'esecuzione della query: {e}")

if __name__ == "__main__":
    print("=== DIAGNOSTICA DATABASE ===")
    test_connection()
    test_specific_query()
    print("\n=== FINE DIAGNOSTICA ===")