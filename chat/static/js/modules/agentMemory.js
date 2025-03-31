/**
 * agentMemory.js - Gestione della memoria per agenti AI
 */

// Configurazione limite memoria
const MAX_HISTORY = 5; // Limita a 5 scambi per default

// Funzione per recuperare o creare il messaggio di memoria
async function getOrCreateMemoryMessage(conversationId, agentId) {
    try {
        // Cerca un messaggio di tipo "memory" esistente per questa conversazione e agente
        const response = await fetch(`/chat/api/memory/${conversationId}?agent_id=${agentId}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.id) {
                console.log('Messaggio memory recuperato:', data);
                return data;
            }
        }
        
        // Se non esiste, creane uno nuovo
        console.log('Creazione nuovo messaggio memory per conversazione:', conversationId, 'agente:', agentId);
        const createResponse = await fetch('/chat/api/memory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                conversation_id: conversationId,
                user_id: agentId,
                text: "Memory storage - non visualizzato",
                message_type: "memory",
                message_metadata: {
                    history: [],
                    agent_id: agentId
                }
            })
        });
        
        if (createResponse.ok) {
            return await createResponse.json();
        } else {
            console.error('Errore nella creazione del messaggio memory:', await createResponse.text());
            return null;
        }
    } catch (error) {
        console.error('Errore nel recupero/creazione del messaggio memory:', error);
        return null;
    }
}

// Funzione per aggiornare la memoria con un nuovo scambio
function updateMemory(memoryMessage, userMessage, botResponse, maxHistory = MAX_HISTORY) {
    // Assicurati che message_metadata e history esistano
    if (!memoryMessage.message_metadata) {
        memoryMessage.message_metadata = {};
    }
    
    let history = memoryMessage.message_metadata.history || [];
    
    // Aggiungi il nuovo scambio
    history.push({
        user: userMessage,
        bot: botResponse,
        timestamp: new Date().toISOString()
    });
    
    // Flag per indicare se la memoria è stata troncata
    let wasTruncated = false;
    
    // Mantieni solo gli ultimi maxHistory scambi (FIFO)
    if (history.length > maxHistory) {
        history = history.slice(-maxHistory);
        wasTruncated = true;
    }
    
    // Aggiorna il messaggio
    memoryMessage.message_metadata.history = history;
    memoryMessage.message_metadata.lastUpdated = new Date().toISOString();
    
    // Salva il messaggio aggiornato
    saveMemoryMessage(memoryMessage);
    
    return wasTruncated;
}

// Funzione per salvare il messaggio memory aggiornato
async function saveMemoryMessage(memoryMessage) {
    try {
        const response = await fetch(`/chat/api/memory/${memoryMessage.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(memoryMessage)
        });
        
        if (!response.ok) {
            console.error('Errore nel salvataggio del messaggio memory:', await response.text());
        }
    } catch (error) {
        console.error('Errore nella richiesta di aggiornamento memoria:', error);
    }
}

// Funzione per costruire il prompt con la storia della conversazione
function buildPromptWithHistory(memoryMessage, currentMessage, customPrompt) {
    const history = memoryMessage.message_metadata?.history || [];
    
    // Prompt base se non fornito un prompt personalizzato
    let prompt = customPrompt || `Sei un assistente AI che fornisce risposte:
- Mediamente brevi
- Senza formattazione eccessiva
- Con un tono neutro e gentile
- Sempre pertinenti al contesto della conversazione

`;

    // Aggiungi la storia solo se esiste
    if (history.length > 0) {
        prompt += `Ecco la storia recente della conversazione:\n`;
        
        history.forEach(exchange => {
            prompt += `Utente: ${exchange.user}\nAssistente: ${exchange.bot}\n\n`;
        });
    }
    
    // Aggiungi il messaggio corrente
    prompt += `Utente: ${currentMessage}\nAssistente:`;
    
    return prompt;
}

// Funzione principale per processare un messaggio per un agente
async function processAgentMessage(message, conversationId, messageId, agentId, customPrompt = null, maxHistory = MAX_HISTORY) {
    console.log(`Elaborazione messaggio per agente ${agentId}:`, message);
    
    try {
        // Recupera o crea il messaggio memory
        const memoryMessage = await getOrCreateMemoryMessage(conversationId, agentId);
        if (!memoryMessage) {
            console.error('Impossibile recuperare o creare il messaggio memory');
            return null;
        }
        
        // Costruisci il prompt con la storia
        const prompt = buildPromptWithHistory(memoryMessage, message, customPrompt);
        console.log('Prompt completo:', prompt);
        
        // Ottieni risposta dal modello (usando la stessa funzione di John Doe)
        const response = await getLLMResponse(prompt);
        console.log(`Risposta ricevuta dall'agente ${agentId}:`, response);
        
        // Aggiorna la memoria
        const wasTruncated = updateMemory(memoryMessage, message, response, maxHistory);
        
        // Restituisci la risposta e il flag di troncamento
        return {
            response: response,
            memoryTruncated: wasTruncated
        };
    } catch (error) {
        console.error(`Errore nell'elaborazione del messaggio per l'agente ${agentId}:`, error);
        return null;
    }
}

// Esporta funzioni
export {
    getOrCreateMemoryMessage,
    updateMemory,
    buildPromptWithHistory,
    processAgentMessage,
    MAX_HISTORY
};